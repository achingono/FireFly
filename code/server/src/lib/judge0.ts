import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { env } from "../config/env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_TRACER = readFileSync(join(__dirname, "../tracers/python.py"), "utf-8");
const JS_TRACER = readFileSync(join(__dirname, "../tracers/javascript.js"), "utf-8");

export const LANGUAGE_IDS: Record<string, number> = {
  python: 71,
  javascript: 63,
  c: 50,
  cpp: 54,
  java: 62,
};

export interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
  wall_time_limit?: number;
}

export interface Judge0Result {
  token: string;
  stdout: string | null;
  stderr: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
  compile_output: string | null;
  exit_code: number | null;
}

export interface TraceFrame {
  step: number;
  line: number;
  event: string;
  funcName: string;
  locals: Record<string, string>;
  stack: Array<{ funcName: string; line: number; locals: Record<string, string> }>;
  returnValue: string | null;
  exception: string | null;
}

export interface TraceOutput {
  frames: TraceFrame[];
  stdout: string;
  stderr: string;
  error: { type: string; message: string } | null;
}

export interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  error?: string;
}

const ROSETTA_STDERR_FRAGMENT = "rosetta error: mmap_anonymous_rw mmap failed";

export function wrapWithJsTracer(userCode: string): string {
  const encoded = Buffer.from(userCode, "utf-8").toString("base64");
  return JS_TRACER.replace("__BASE64_CODE__", encoded);
}

export function wrapWithTracer(userCode: string): string {
  const encoded = Buffer.from(userCode, "utf-8").toString("base64");
  return PYTHON_TRACER.replace("__BASE64_CODE__", encoded);
}

export async function submitToJudge0(submission: Judge0Submission): Promise<string> {
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

export async function getJudge0Result(token: string): Promise<Judge0Result> {
  const res = await fetch(
    `${env.JUDGE0_URL}/submissions/${token}?base64_encoded=false&fields=token,stdout,stderr,status,time,memory,compile_output,exit_code`
  );
  if (!res.ok) {
    throw new Error(`Judge0 poll failed: ${res.status}`);
  }
  return await res.json() as Judge0Result;
}

export async function pollJudge0(token: string, maxWaitMs = 30000): Promise<Judge0Result> {
  const start = Date.now();
  const interval = 500;

  while (Date.now() - start < maxWaitMs) {
    const result = await getJudge0Result(token);
    if (result.status.id > 2) {
      return result;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Judge0 execution timed out");
}

export function parseTrace(rawStdout: string): TraceOutput | null {
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

export function buildTestInvocationCode(userCode: string, testInput: string, language: string): string {
  if (language === "python") {
    return `${userCode}\n\n# Test invocation\nprint(${testInput})`;
  }
  if (language === "javascript") {
    return `${userCode}\n\n// Test invocation\nconsole.log(${testInput});`;
  }
  return `${userCode}\n${testInput}`;
}

export function parseJudge0TestResult(result: Judge0Result): { actualOutput: string; error?: string } {
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

export async function evaluateTestCases(
  userCode: string,
  traceStdout: string | null,
  testCases: Array<{ input: string; expectedOutput: string }>,
  language: string,
  languageId: number,
  fastify: any
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const outputTests = testCases.filter(tc => !tc.input.trim());
  const functionTests = testCases.filter(tc => tc.input.trim());

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

export function determineJobStatus(result: Judge0Result): { status: "completed" | "failed" | "timeout"; statusMessage: string } {
  const infrastructureError = getJudge0InfrastructureError(result);
  if (infrastructureError) {
    return { status: "failed", statusMessage: infrastructureError };
  }
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

export function getJudge0InfrastructureError(result: Judge0Result): string | null {
  const stderr = result.stderr?.trim() ?? "";
  if (!stderr.includes(ROSETTA_STDERR_FRAGMENT)) {
    return null;
  }

  return "Code execution is unavailable because Judge0 is running under Rosetta emulation on an Apple Silicon Docker host. Disable Rosetta for Docker Desktop, enable cgroups v1, and follow docs/guides/getting-started.md before retrying.";
}

export function extractTraceAndStdout(
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

export function getWrappedSource(language: string, sourceCode: string): string {
  if (language === "python") return wrapWithTracer(sourceCode);
  if (language === "javascript") return wrapWithJsTracer(sourceCode);
  return sourceCode;
}

export function logJudge0Result(fastify: any, language: string, finalSource: string, sourceCode: string, result: Judge0Result): void {
  if (language === "python" || language === "javascript") {
    fastify.log.debug(`Wrapped ${language} code length: ${finalSource.length}, original: ${sourceCode.length}`);
  }
  fastify.log.info(`Judge0 result: status.id=${result.status.id} (${result.status.description}), exit=${result.exit_code}, stdout_len=${result.stdout?.length ?? 0}, stderr_len=${result.stderr?.length ?? 0}, compile_len=${result.compile_output?.length ?? 0}`);
  if (result.stdout) fastify.log.debug(`Judge0 stdout: ${result.stdout.substring(0, 500)}`);
  if (result.stderr) fastify.log.debug(`Judge0 stderr: ${result.stderr.substring(0, 500)}`);
  if (result.compile_output) fastify.log.debug(`Judge0 compile_output: ${result.compile_output.substring(0, 500)}`);
}

export function buildJobData(
  result: Judge0Result,
  status: "completed" | "failed" | "timeout",
  userStdout: string | null,
  userStderr: string | null,
  statusMessage: string,
  trace: TraceOutput | null,
) {
  const infrastructureError = getJudge0InfrastructureError(result);
  const stderr = infrastructureError
    ? `${infrastructureError}\n\nOriginal stderr:\n${(userStderr ?? result.stderr ?? "").trim()}`
    : userStderr ?? result.compile_output ?? (statusMessage || null);
  const durationMs = result.time ? Math.round(parseFloat(result.time) * 1000) : null;
  return { status, stdout: userStdout, stderr, exitCode: result.exit_code, trace: trace ? JSON.parse(JSON.stringify(trace)) : null, durationMs, memoryKb: result.memory };
}

export async function runTestsAndFinalizeStatus(
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
