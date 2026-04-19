import { spawn } from "child_process";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { env } from "../config/env.js";
import {
  buildTestInvocationCode,
  parseTrace,
  TraceOutput,
  TestResult,
} from "./judge0.js";

type ExecutionStatus = "completed" | "failed" | "timeout";

interface RuntimeConfig {
  image: string;
  fileName: string;
  command: string[];
}

interface ContainerExecutionResult {
  status: ExecutionStatus;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  durationMs: number;
}

interface DockerExecutionOptions {
  language: string;
  wrappedSource: string;
  sourceCode: string;
  stdin?: string;
  testCases?: Array<{ input: string; expectedOutput: string }>;
}

interface DockerExecutionResult {
  status: ExecutionStatus;
  stdout: string | null;
  stderr: string | null;
  trace: TraceOutput | null;
  durationMs: number;
  exitCode: number | null;
  testResults: TestResult[] | null;
}

const MAX_TIMEOUT_MS = 10_000;
const MAX_MEMORY = "128m";
const MAX_CPUS = "1";
const MAX_PIDS = "64";
const TMPFS_CONFIG = "/tmp:rw,noexec,nosuid,size=64m";

function getRuntimeConfig(language: string): RuntimeConfig {
  switch (language) {
    case "python":
      return {
        image: env.EXECUTOR_DOCKER_PYTHON_IMAGE,
        fileName: "main.py",
        command: ["python3", "/workspace/main.py"],
      };
    case "javascript":
      return {
        image: env.EXECUTOR_DOCKER_NODE_IMAGE,
        fileName: "main.js",
        command: ["node", "/workspace/main.js"],
      };
    default:
      throw new Error(
        `Docker executor does not support language: ${language}. Supported: python, javascript`
      );
  }
}

async function runContainerizedCode(
  language: string,
  sourceCode: string,
  stdin?: string,
  timeoutMs = MAX_TIMEOUT_MS
): Promise<ContainerExecutionResult> {
  const runtime = getRuntimeConfig(language);
  await mkdir(env.EXECUTOR_DOCKER_WORKDIR, { recursive: true });
  const workDir = await mkdtemp(
    join(env.EXECUTOR_DOCKER_WORKDIR, "firefly-exec-")
  );
  const sourcePath = join(workDir, runtime.fileName);

  try {
    await writeFile(sourcePath, sourceCode, "utf8");

    const args = [
      "run",
      "--rm",
      "--network",
      "none",
      "--memory",
      MAX_MEMORY,
      "--cpus",
      MAX_CPUS,
      "--pids-limit",
      MAX_PIDS,
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--tmpfs",
      TMPFS_CONFIG,
      "-i",
      "-v",
      `${workDir}:/workspace:ro`,
      runtime.image,
      ...runtime.command,
    ];

    const startedAt = Date.now();
    const child = spawn("docker", args, { stdio: "pipe" });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    const completion = new Promise<{ exitCode: number | null }>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (exitCode) => resolve({ exitCode }));
    });

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();

    const timeout = new Promise<{ exitCode: number | null }>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
        resolve({ exitCode: null });
      }, timeoutMs);
    });

    const { exitCode } = await Promise.race([completion, timeout]);
    const durationMs = Date.now() - startedAt;

    return {
      status: timedOut ? "timeout" : exitCode === 0 ? "completed" : "failed",
      stdout: stdout || null,
      stderr: stderr || null,
      exitCode,
      durationMs,
    };
  } catch (error) {
    throw new Error(
      `Docker executor failed: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function buildExecutionErrorMessage(
  status: ExecutionStatus,
  trace: TraceOutput | null,
  stderr: string | null
): string | null {
  if (status === "timeout") {
    return "Execution timed out";
  }

  if (trace?.error) {
    const parts = [`${trace.error.type}: ${trace.error.message}`];
    if (stderr?.trim()) {
      parts.push(stderr.trim());
    }
    return parts.join("\n\n");
  }

  return stderr?.trim() ? stderr.trim() : null;
}

async function evaluateDockerTestCases(
  sourceCode: string,
  traceStdout: string | null,
  testCases: Array<{ input: string; expectedOutput: string }>,
  language: string
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const outputTests = testCases.filter((testCase) => !testCase.input.trim());
  const invocationTests = testCases.filter((testCase) => testCase.input.trim());

  if (outputTests.length > 0) {
    const actualOutput = (traceStdout ?? "").trim();
    for (const testCase of outputTests) {
      results.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput,
        passed: actualOutput === testCase.expectedOutput.trim(),
      });
    }
  }

  for (const testCase of invocationTests) {
    const invocationCode = buildTestInvocationCode(
      sourceCode,
      testCase.input,
      language
    );
    const execution = await runContainerizedCode(language, invocationCode);
    const actualOutput = (execution.stdout ?? "").trim();
    const error =
      execution.status === "timeout"
        ? "Execution timed out"
        : execution.status === "failed"
          ? execution.stderr?.trim() || "Execution failed"
          : undefined;

    results.push({
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput,
      passed: !error && actualOutput === testCase.expectedOutput.trim(),
      error,
    });
  }

  return results;
}

export async function executeWithDocker(
  options: DockerExecutionOptions
): Promise<DockerExecutionResult> {
  const execution = await runContainerizedCode(
    options.language,
    options.wrappedSource,
    options.stdin
  );
  const trace = execution.stdout ? parseTrace(execution.stdout) : null;
  const traceStdout = trace?.stdout ?? execution.stdout;
  const traceStderr = trace?.stderr ?? null;
  let status = execution.status;
  let stderr = buildExecutionErrorMessage(
    execution.status,
    trace,
    traceStderr ?? execution.stderr
  );

  let testResults: TestResult[] | null = null;
  if (status === "completed" && options.testCases && options.testCases.length > 0) {
    testResults = await evaluateDockerTestCases(
      options.sourceCode,
      traceStdout,
      options.testCases,
      options.language
    );
    if (!testResults.every((result) => result.passed)) {
      status = "failed";
    }
  }

  if (status === "failed" && !stderr && testResults?.some((result) => result.error)) {
    stderr = testResults
      .map((result) => result.error)
      .filter((value): value is string => Boolean(value))
      .join("\n\n");
  }

  return {
    status,
    stdout: traceStdout,
    stderr,
    trace,
    durationMs: execution.durationMs,
    exitCode: execution.exitCode,
    testResults,
  };
}
