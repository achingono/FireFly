import { FastifyPluginAsync } from "fastify";
import prisma from "../config/database.js";
import { env } from "../config/env.js";

// Python tracer script — wraps user code to generate canonical trace frames
const PYTHON_TRACER = `
import sys, json, traceback as _tb

_trace_frames = []
_step = 0
_start = None

def _tracer(frame, event, arg):
    global _step, _start
    filename = frame.f_code.co_filename
    if filename != '<user_code>':
        return _tracer
    if _start is None:
        _start = frame.f_lineno

    if event in ('line', 'call', 'return', 'exception'):
        _step += 1
        # Collect locals (simple values only)
        local_vars = {}
        for k, v in frame.f_locals.items():
            if k.startswith('_'):
                continue
            try:
                local_vars[k] = repr(v)
            except:
                local_vars[k] = '<unprintable>'

        # Build stack
        stack = []
        f = frame
        while f:
            if f.f_code.co_filename == '<user_code>':
                stack.append({
                    "funcName": f.f_code.co_name,
                    "line": f.f_lineno,
                    "locals": {k: repr(v) for k, v in f.f_locals.items() if not k.startswith('_')}
                })
            f = f.f_back
        stack.reverse()

        _trace_frames.append({
            "step": _step,
            "line": frame.f_lineno,
            "event": event,
            "funcName": frame.f_code.co_name,
            "locals": local_vars,
            "stack": stack,
            "returnValue": repr(arg) if event == 'return' else None,
            "exception": str(arg[1]) if event == 'exception' and arg else None,
        })

    return _tracer

# Capture stdout
from io import StringIO
_captured_stdout = StringIO()
_captured_stderr = StringIO()
_orig_stdout = sys.stdout
_orig_stderr = sys.stderr
sys.stdout = _captured_stdout
sys.stderr = _captured_stderr

_user_error = None
try:
    _code = open('/dev/stdin').read() if False else None  # placeholder
    sys.settrace(_tracer)
    exec(compile(_USER_CODE_, '<user_code>', 'exec'))
except Exception as e:
    _user_error = {"type": type(e).__name__, "message": str(e)}
finally:
    sys.settrace(None)
    sys.stdout = _orig_stdout
    sys.stderr = _orig_stderr

print("---TRACE_START---")
print(json.dumps({
    "frames": _trace_frames,
    "stdout": _captured_stdout.getvalue(),
    "stderr": _captured_stderr.getvalue(),
    "error": _user_error,
}))
print("---TRACE_END---")
`;

function wrapWithTracer(userCode: string): string {
  // Escape the user code as a string literal for the tracer
  const escaped = userCode.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"');
  const wrapped = PYTHON_TRACER.replace(
    "_USER_CODE_",
    `"""${escaped}"""`
  );
  return wrapped;
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

      // For Python, wrap with tracer
      const finalSource = language === "python" ? wrapWithTracer(sourceCode) : sourceCode;

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

        // Determine status
        let status: "completed" | "failed" | "timeout" = "completed";
        if (result.status.id === 5) status = "timeout"; // Time Limit Exceeded
        else if (result.status.id !== 3) status = "failed"; // 3 = Accepted

        // Parse trace from stdout (Python only)
        let trace = null;
        let userStdout = result.stdout;
        let userStderr = result.stderr;

        if (language === "python" && result.stdout) {
          const parsed = parseTrace(result.stdout);
          if (parsed) {
            trace = parsed;
            userStdout = parsed.stdout;
            userStderr = parsed.stderr || result.stderr;
          }
        }

        // Update job
        await prisma.executionJob.update({
          where: { id: job.id },
          data: {
            status,
            stdout: userStdout,
            stderr: userStderr ?? result.compile_output,
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
          stderr: userStderr ?? result.compile_output,
          trace,
          durationMs: result.time ? Math.round(parseFloat(result.time) * 1000) : null,
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
