import { FastifyPluginAsync } from "fastify";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import prisma from "../config/database.js";
import { env } from "../config/env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_TRACER = readFileSync(join(__dirname, "../tracers/python.py"), "utf-8");
const JS_TRACER = readFileSync(join(__dirname, "../tracers/javascript.js"), "utf-8");



function wrapWithJsTracer(userCode: string): string {
  const encoded = Buffer.from(userCode, "utf-8").toString("base64");
  return JS_TRACER.replace("__BASE64_CODE__", encoded);
}

function wrapWithTracer(userCode: string): string {
  const encoded = Buffer.from(userCode, "utf-8").toString("base64");
  return PYTHON_TRACER.replace("__BASE64_CODE__", encoded);
}

// Judge0 language IDs
const LANGUAGE_IDS: Record<string, number> = {
  python: 71,     // Python 3
  javascript: 63, // Node.js
  c: 50,          // C (GCC)
  cpp: 54,        // C++ (GCC)
  java: 62,       // Java (OpenJDK)
};

interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
  wall_time_limit?: number;
}

interface Judge0Result {
  token: string;
  stdout: string | null;
  stderr: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
  compile_output: string | null;
  exit_code: number | null;
}

async function submitToJudge0(submission: Judge0Submission): Promise<string> {
  const res = await fetch(`${env.JUDGE0_URL}/submissions?base64_encoded=false&wait=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Judge0 submission failed: ${res.status} ${text}`);
  }
  const data = await res.json() as { token: string };
  return data.token;
}

async function getJudge0Result(token: string): Promise<Judge0Result> {
  const res = await fetch(
    `${env.JUDGE0_URL}/submissions/${token}?base64_encoded=false&fields=token,stdout,stderr,status,time,memory,compile_output,exit_code`
  );
  if (!res.ok) {
    throw new Error(`Judge0 poll failed: ${res.status}`);
  }
  return await res.json() as Judge0Result;
}

async function pollJudge0(token: string, maxWaitMs = 30000): Promise<Judge0Result> {
  const start = Date.now();
  const interval = 500;

  while (Date.now() - start < maxWaitMs) {
    const result = await getJudge0Result(token);
    // Status 1 = In Queue, 2 = Processing
    if (result.status.id > 2) {
      return result;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Judge0 execution timed out");
}

interface TraceFrame {
  step: number;
  line: number;
  event: string;
  funcName: string;
  locals: Record<string, string>;
  stack: Array<{ funcName: string; line: number; locals: Record<string, string> }>;
  returnValue: string | null;
  exception: string | null;
}

interface TraceOutput {
  frames: TraceFrame[];
  stdout: string;
  stderr: string;
  error: { type: string; message: string } | null;
}

function parseTrace(rawStdout: string): TraceOutput | null {
  const startMarker = "---TRACE_START---";
  const endMarker = "---TRACE_END---";
  const startIdx = rawStdout.indexOf(startMarker);
  const endIdx = rawStdout.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    return null;
  }

  const jsonStr = rawStdout.substring(startIdx + startMarker.length, endIdx).trim();
  try {
    return JSON.parse(jsonStr) as TraceOutput;
  } catch {
    return null;
  }
}

interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  error?: string;
}

function buildTestInvocationCode(userCode: string, testInput: string, language: string): string {
  if (language === "python") {
    return `${userCode}\n\n# Test invocation\nprint(${testInput})`;
  }
  if (language === "javascript") {
    return `${userCode}\n\n// Test invocation\nconsole.log(${testInput});`;
  }
  return `${userCode}\n${testInput}`;
}

function parseJudge0TestResult(result: Judge0Result): { actualOutput: string; error?: string } {
  if (result.status.id === 3) {
    return { actualOutput: (result.stdout || "").trim() };
  }
  if (result.status.id === 6) {
    return { actualOutput: "", error: `Compilation Error: ${result.compile_output || "Unknown error"}` };
  }
  if (result.status.id === 7) {
    return { actualOutput: (result.stdout || "").trim(), error: `Runtime Error: ${result.stderr || "Unknown error"}` };
  }
  return { actualOutput: (result.stdout || "").trim(), error: `Execution failed: ${result.status.description}` };
}

/**
 * Evaluate user code against test cases.
 *
 * For empty-input test cases (self-contained exercises that produce their own
 * output), we compare the already-captured stdout from the trace execution
 * directly — no extra Judge0 calls needed.
 *
 * For non-empty-input test cases (function-style exercises where the test
 * provides a calling expression), we submit each test case to Judge0 separately
 * because the code+invocation differs from the original execution.
 */
async function evaluateTestCases(
  userCode: string,
  traceStdout: string | null,
  testCases: Array<{ input: string; expectedOutput: string }>,
  language: string,
  languageId: number,
  fastify: any
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Partition test cases into output-comparison (empty input) vs function-call (non-empty input)
  const outputTests = testCases.filter(tc => !tc.input.trim());
  const functionTests = testCases.filter(tc => tc.input.trim());

  // --- Output-comparison tests: compare trace stdout directly ---
  if (outputTests.length > 0) {
    const actualOutput = (traceStdout ?? "").trim();

    for (const testCase of outputTests) {
      const expectedNormalized = testCase.expectedOutput.trim();
      const passed = expectedNormalized === actualOutput;

      results.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput,
        passed,
      });

      fastify.log.debug(
        `Output test: expected="${expectedNormalized}", actual="${actualOutput}", passed=${passed}`
      );
    }
  }

  // --- Function-call tests: need separate Judge0 execution ---
  for (const testCase of functionTests) {
    try {
      const testCode = buildTestInvocationCode(userCode, testCase.input, language);

      const token = await submitToJudge0({
        source_code: testCode,
        language_id: languageId,
        cpu_time_limit: 5,
        memory_limit: 128000,
        wall_time_limit: 10,
      });

      const result = await pollJudge0(token);

      const { actualOutput, error } = parseJudge0TestResult(result);

      const expectedNormalized = testCase.expectedOutput.trim();
      const actualNormalized = actualOutput.trim();
      const passed = expectedNormalized === actualNormalized && !error;

      results.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput,
        passed,
        error,
      });

      fastify.log.debug(
        `Function test: input="${testCase.input}", expected="${expectedNormalized}", actual="${actualNormalized}", passed=${passed}`
      );
    } catch (err) {
      results.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: "",
        passed: false,
        error: `Test execution failed: ${(err as Error).message}`,
      });
    }
  }

  return results;
}

function determineJobStatus(result: Judge0Result): { status: "completed" | "failed" | "timeout"; statusMessage: string } {
  if (result.status.id === 5) {
    return { status: "timeout", statusMessage: "Time Limit Exceeded" };
  }
  if (result.status.id === 6) {
    return { status: "failed", statusMessage: `Compilation Error: ${result.compile_output || "No details"}` };
  }
  if (result.status.id === 7) {
    return { status: "failed", statusMessage: `Runtime Error: ${result.stderr || "No stderr captured"}` };
  }
  if (result.status.id !== 3) {
    return { status: "failed", statusMessage: `Judge0 Status ${result.status.id}: ${result.status.description}` };
  }
  return { status: "completed", statusMessage: "" };
}

function extractTraceAndStdout(
  language: string,
  result: Judge0Result
): { trace: TraceOutput | null; userStdout: string | null; userStderr: string | null } {
  if ((language === "python" || language === "javascript") && result.stdout) {
    const parsed = parseTrace(result.stdout);
    if (parsed) {
      return { trace: parsed, userStdout: parsed.stdout, userStderr: parsed.stderr };
    }
  }
  return { trace: null, userStdout: result.stdout, userStderr: result.stderr };
}

function getWrappedSource(language: string, sourceCode: string): string {
  if (language === "python") return wrapWithTracer(sourceCode);
  if (language === "javascript") return wrapWithJsTracer(sourceCode);
  return sourceCode;
}

function logJudge0Result(fastify: any, language: string, finalSource: string, sourceCode: string, result: Judge0Result): void {
  if (language === "python" || language === "javascript") {
    fastify.log.debug(`Wrapped ${language} code length: ${finalSource.length}, original: ${sourceCode.length}`);
  }
  fastify.log.info(`Judge0 result: status.id=${result.status.id} (${result.status.description}), exit=${result.exit_code}, stdout_len=${result.stdout?.length ?? 0}, stderr_len=${result.stderr?.length ?? 0}, compile_len=${result.compile_output?.length ?? 0}`);
  if (result.stdout) fastify.log.debug(`Judge0 stdout: ${result.stdout.substring(0, 500)}`);
  if (result.stderr) fastify.log.debug(`Judge0 stderr: ${result.stderr.substring(0, 500)}`);
  if (result.compile_output) fastify.log.debug(`Judge0 compile_output: ${result.compile_output.substring(0, 500)}`);
}

function buildJobData(
  result: Judge0Result,
  status: "completed" | "failed" | "timeout",
  userStdout: string | null,
  userStderr: string | null,
  statusMessage: string,
  trace: TraceOutput | null,
) {
  const stderr = userStderr ?? result.compile_output ?? (statusMessage || null);
  const durationMs = result.time ? Math.round(parseFloat(result.time) * 1000) : null;
  return { status, stdout: userStdout, stderr, exitCode: result.exit_code, trace: trace ? JSON.parse(JSON.stringify(trace)) : null, durationMs, memoryKb: result.memory };
}

async function runTestsAndFinalizeStatus(
  exercise: { testCases: unknown } | null,
  status: "completed" | "failed" | "timeout",
  sourceCode: string,
  userStdout: string | null,
  language: string,
  languageId: number,
  fastify: any
): Promise<{ testResults: TestResult[] | null; finalStatus: "completed" | "failed" | "timeout" }> {
  if (!exercise || status !== "completed") {
    return { testResults: null, finalStatus: status };
  }
  const exerciseTestCases = exercise.testCases as Array<{ input: string; expectedOutput: string }>;
  if (exerciseTestCases.length === 0) {
    return { testResults: null, finalStatus: status };
  }
  const testResults = await evaluateTestCases(sourceCode, userStdout, exerciseTestCases, language, languageId, fastify);
  const finalStatus = testResults.every(tr => tr.passed) ? status : "failed";
  return { testResults, finalStatus };
}

const executionRoutes: FastifyPluginAsync = async (fastify) => {
  /** POST /api/v1/execution/run — Submit code for execution */
  fastify.post<{
    Body: {
      language: string;
      sourceCode: string;
      stdin?: string;
      exerciseId?: string;
    };
  }>(
    "/api/v1/execution/run",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { language, sourceCode, stdin, exerciseId } = request.body;
      const userId = request.user.sub;

      const MAX_SOURCE_BYTES = 64 * 1024; // 64 KB
      if (Buffer.byteLength(sourceCode, "utf8") > MAX_SOURCE_BYTES) {
        return reply.envelopeError(
          "ValidationError",
          "Source code exceeds the maximum allowed size of 64 KB.",
          undefined,
          400
        );
      }

      const languageId = LANGUAGE_IDS[language];
      if (!languageId) {
        return reply.envelopeError(
          "ValidationError",
          `Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGE_IDS).join(", ")}`,
          undefined,
          400
        );
      }

      // Fetch exercise if exerciseId is provided
      let exercise = null;
      if (exerciseId) {
        exercise = await prisma.exercise.findUnique({
          where: { id: exerciseId },
          select: {
            id: true,
            testCases: true,
            language: true,
          },
        });
        if (!exercise) {
          return reply.envelopeError("NotFound", "Exercise not found", undefined, 404);
        }
      }

      const finalSource = getWrappedSource(language, sourceCode);

      const job = await prisma.executionJob.create({
        data: {
          userId,
          exerciseId: exerciseId ?? null,
          language,
          sourceCode,
          stdin: stdin ?? null,
          status: "queued",
        },
      });

      try {
        const token = await submitToJudge0({
          source_code: finalSource,
          language_id: languageId,
          stdin: stdin ?? undefined,
          cpu_time_limit: 5,
          memory_limit: 128000,
          wall_time_limit: 10,
        });

        await prisma.executionJob.update({
          where: { id: job.id },
          data: { judge0Token: token, status: "running" },
        });

        const result = await pollJudge0(token);
        logJudge0Result(fastify, language, finalSource, sourceCode, result);

        const { status: resolvedStatus, statusMessage } = determineJobStatus(result);
        const { trace, userStdout, userStderr } = extractTraceAndStdout(language, result);
        const { testResults, finalStatus } = await runTestsAndFinalizeStatus(
          exercise, resolvedStatus, sourceCode, userStdout, language, languageId, fastify
        );

        const jobData = buildJobData(result, finalStatus, userStdout, userStderr, statusMessage, trace);
        await prisma.executionJob.update({ where: { id: job.id }, data: jobData });

        return reply.status(201).envelope({
          jobId: job.id,
          status: finalStatus,
          stdout: userStdout,
          stderr: jobData.stderr,
          trace,
          durationMs: jobData.durationMs,
          testResults,
          allTestsPassed: testResults ? testResults.every(tr => tr.passed) : null,
        });
      } catch (err) {
        // Mark job as failed
        await prisma.executionJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            stderr: (err as Error).message,
          },
        });
        return reply.envelopeError(
          "ExecutionError",
          (err as Error).message,
          undefined,
          502
        );
      }
    }
  );

  /** GET /api/v1/execution/jobs/:id — Get execution job status */
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/execution/jobs/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const job = await prisma.executionJob.findUnique({
        where: { id: request.params.id },
      });
      if (!job) {
        return reply.envelopeError("NotFound", "Execution job not found", undefined, 404);
      }
      // Users can only see their own jobs (unless admin)
      if (job.userId !== request.user.sub && request.user.role !== "admin") {
        return reply.envelopeError("Forbidden", "Not your execution job", undefined, 403);
      }
      return reply.envelope(job);
    }
  );

  /** GET /api/v1/execution/jobs/:id/trace — Get execution trace */
  fastify.get<{ Params: { id: string } }>(
    "/api/v1/execution/jobs/:id/trace",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const job = await prisma.executionJob.findUnique({
        where: { id: request.params.id },
        select: { id: true, userId: true, trace: true, stdout: true, stderr: true, status: true },
      });
      if (!job) {
        return reply.envelopeError("NotFound", "Execution job not found", undefined, 404);
      }
      if (job.userId !== request.user.sub && request.user.role !== "admin") {
        return reply.envelopeError("Forbidden", "Not your execution job", undefined, 403);
      }
      return reply.envelope({
        jobId: job.id,
        status: job.status,
        trace: job.trace,
        stdout: job.stdout,
        stderr: job.stderr,
      });
    }
  );
};

export default executionRoutes;
