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
      let testCode: string;
      if (language === "python") {
        testCode = `${userCode}\n\n# Test invocation\nprint(${testCase.input})`;
      } else if (language === "javascript") {
        testCode = `${userCode}\n\n// Test invocation\nconsole.log(${testCase.input});`;
      } else {
        testCode = `${userCode}\n${testCase.input}`;
      }

      const token = await submitToJudge0({
        source_code: testCode,
        language_id: languageId,
        cpu_time_limit: 5,
        memory_limit: 128000,
        wall_time_limit: 10,
      });

      const result = await pollJudge0(token);

      let actualOutput = "";
      let error: string | undefined;

      if (result.status.id === 3) {
        actualOutput = (result.stdout || "").trim();
      } else if (result.status.id === 6) {
        error = `Compilation Error: ${result.compile_output || "Unknown error"}`;
      } else if (result.status.id === 7) {
        error = `Runtime Error: ${result.stderr || "Unknown error"}`;
        actualOutput = (result.stdout || "").trim();
      } else {
        error = `Execution failed: ${result.status.description}`;
        actualOutput = (result.stdout || "").trim();
      }

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

      // Wrap with tracer for supported languages
      const finalSource =
        language === "python" ? wrapWithTracer(sourceCode) :
        language === "javascript" ? wrapWithJsTracer(sourceCode) :
        sourceCode;

      // Create execution job in DB
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
        // Log the wrapped code for debugging
        if (language === "python") {
          fastify.log.debug(`Wrapped Python code length: ${finalSource.length}, original: ${sourceCode.length}`);
        }
        if (language === "javascript") {
          fastify.log.debug(`Wrapped JS code length: ${finalSource.length}, original: ${sourceCode.length}`);
        }
        
        // Submit to Judge0
        const token = await submitToJudge0({
          source_code: finalSource,
          language_id: languageId,
          stdin: stdin ?? undefined,
          cpu_time_limit: 5,
          memory_limit: 128000, // 128 MB
          wall_time_limit: 10,
        });

        // Update job with Judge0 token
        await prisma.executionJob.update({
          where: { id: job.id },
          data: { judge0Token: token, status: "running" },
        });

        // Poll for result
        const result = await pollJudge0(token);
        
        // Log full Judge0 response for debugging
        fastify.log.info(`Judge0 result: status.id=${result.status.id} (${result.status.description}), exit=${result.exit_code}, stdout_len=${result.stdout?.length ?? 0}, stderr_len=${result.stderr?.length ?? 0}, compile_len=${result.compile_output?.length ?? 0}`);
        if (result.stdout) fastify.log.debug(`Judge0 stdout: ${result.stdout.substring(0, 500)}`);
        if (result.stderr) fastify.log.debug(`Judge0 stderr: ${result.stderr.substring(0, 500)}`);
        if (result.compile_output) fastify.log.debug(`Judge0 compile_output: ${result.compile_output.substring(0, 500)}`);

        // Determine status
        let status: "completed" | "failed" | "timeout" = "completed";
        let statusMessage = "";
        if (result.status.id === 5) {
          status = "timeout";
          statusMessage = "Time Limit Exceeded";
        } else if (result.status.id === 6) {
          status = "failed";
          statusMessage = `Compilation Error: ${result.compile_output || "No details"}`;
        } else if (result.status.id === 7) {
          status = "failed";
          statusMessage = `Runtime Error: ${result.stderr || "No stderr captured"}`;
        } else if (result.status.id !== 3) {
          status = "failed";
          statusMessage = `Judge0 Status ${result.status.id}: ${result.status.description}`;
        }

        // Parse trace from stdout (Python and JavaScript)
        let trace = null;
        let userStdout = result.stdout;
        let userStderr = result.stderr;

        if ((language === "python" || language === "javascript") && result.stdout) {
          const parsed = parseTrace(result.stdout);
          if (parsed) {
            trace = parsed;
            userStdout = parsed.stdout;
            userStderr = parsed.stderr ?? result.stderr;
          }
        }

        // Evaluate test cases if exercise is provided and execution succeeded
        let testResults: TestResult[] | null = null;
        if (exercise && status === "completed") {
          const exerciseTestCases = exercise.testCases as Array<{ input: string; expectedOutput: string }>;
          if (exerciseTestCases.length > 0) {
            testResults = await evaluateTestCases(
              sourceCode,
              userStdout,
              exerciseTestCases,
              language,
              languageId,
              fastify
            );

            // If any test failed, mark the overall execution as failed
            const allPassed = testResults.every(tr => tr.passed);
            if (!allPassed) {
              status = "failed";
            }
          }
        }

        // Update job
        await prisma.executionJob.update({
          where: { id: job.id },
          data: {
            status,
            stdout: userStdout,
            stderr: userStderr ?? result.compile_output ?? (statusMessage || null),
            exitCode: result.exit_code,
            trace: trace ? JSON.parse(JSON.stringify(trace)) : null,
            durationMs: result.time ? Math.round(parseFloat(result.time) * 1000) : null,
            memoryKb: result.memory,
          },
        });

        return reply.status(201).envelope({
          jobId: job.id,
          status,
          stdout: userStdout,
          stderr: userStderr ?? result.compile_output ?? (statusMessage || null),
          trace,
          durationMs: result.time ? Math.round(parseFloat(result.time) * 1000) : null,
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
