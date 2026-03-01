import { FastifyPluginAsync } from "fastify";
import prisma from "../config/database.js";
import { env } from "../config/env.js";

// Python tracer script — wraps user code to generate canonical trace frames
const PYTHON_TRACER = `
import sys, json, base64

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
            if k.startswith('_') or k in _builtin_names:
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
                    "locals": {k: repr(v) for k, v in f.f_locals.items() if not k.startswith('_') and k not in _builtin_names}
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

_builtin_names = set(dir()) | {'_builtin_names', '_user_code', '_user_error'}
_user_error = None
try:
    _user_code = base64.b64decode("__BASE64_CODE__").decode("utf-8")
    sys.settrace(_tracer)
    exec(compile(_user_code, '<user_code>', 'exec'))
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

// JavaScript tracer script — wraps user code to generate canonical trace frames
// Uses source-level instrumentation with vm.runInNewContext() (Node.js 12 compatible)
const JS_TRACER = `
'use strict';
var vm = require('vm');

var MAX_FRAMES = 500;
var TIMEOUT_MS = 5000;
var _frames = [];
var _step = 0;
var _callStack = [{ funcName: '<module>', line: 0 }];
var _capturedStdout = [];
var _capturedStderr = [];
var _userError = null;
var _done = false;

// Decode user code from base64
var _userCode = Buffer.from('__BASE64_CODE__', 'base64').toString('utf-8');
var _userLines = _userCode.split('\\n');
var _totalLines = _userLines.length;

// Instrument the user code: prepend _t(lineNum) before each non-empty line
// Also convert let/const to var so variables are accessible on the sandbox context
function _instrumentCode(code) {
  // Convert let/const to var so variables land on the sandbox object
  // This allows the tracer to read them via Object.keys(_sandbox)
  code = code.replace(/\\b(let|const)\\s+/g, 'var ');
  var lines = code.split('\\n');
  var result = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();
    // Skip empty lines and lines that are just comments
    if (trimmed === '' || trimmed.startsWith('//')) {
      result.push(line);
      continue;
    }
    // Skip lines that are just closing braces/brackets
    if (trimmed === '}' || trimmed === '};' || trimmed === ']' || trimmed === '];') {
      result.push(line);
      continue;
    }
    // Prepend trace call before each executable line
    result.push('_t(' + (i + 1) + '); ' + line);
  }
  return result.join('\\n');
}

// Stringify a value for trace output (like Python repr)
function _repr(val) {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'function') return 'function ' + (val.name || 'anonymous') + '()';
  try {
    return JSON.stringify(val);
  } catch(e) {
    return String(val);
  }
}

// Build the sandbox context
var _sandbox = {
  console: {
    log: function() {
      var args = Array.prototype.slice.call(arguments);
      _capturedStdout.push(args.map(String).join(' '));
    },
    error: function() {
      var args = Array.prototype.slice.call(arguments);
      _capturedStderr.push(args.map(String).join(' '));
    },
    warn: function() {
      var args = Array.prototype.slice.call(arguments);
      _capturedStderr.push(args.map(String).join(' '));
    },
    info: function() {
      var args = Array.prototype.slice.call(arguments);
      _capturedStdout.push(args.map(String).join(' '));
    }
  },
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  isFinite: isFinite,
  Math: Math,
  Date: Date,
  JSON: JSON,
  Array: Array,
  Object: Object,
  String: String,
  Number: Number,
  Boolean: Boolean,
  RegExp: RegExp,
  Error: Error,
  TypeError: TypeError,
  RangeError: RangeError,
  SyntaxError: SyntaxError,
  ReferenceError: ReferenceError,
  undefined: undefined,
  NaN: NaN,
  Infinity: Infinity,
  _t: null // will be set below
};

// Set of keys that are sandbox infrastructure (not user variables)
var _builtinKeys = new Set(Object.keys(_sandbox));
_builtinKeys.add('_t');

// Trace function — called before each user line
_sandbox._t = function(lineNum) {
  if (_done || _step >= MAX_FRAMES) {
    _done = true;
    return;
  }
  _step++;

  // Collect locals from sandbox (only user-defined variables)
  var locals = {};
  var keys = Object.keys(_sandbox);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (_builtinKeys.has(k)) continue;
    try {
      locals[k] = _repr(_sandbox[k]);
    } catch(e) {
      locals[k] = '<error>';
    }
  }

  // Build stack (single frame for top-level code)
  var stack = [];
  for (var s = 0; s < _callStack.length; s++) {
    var sf = _callStack[s];
    stack.push({
      funcName: sf.funcName,
      line: lineNum,
      locals: locals
    });
  }

  _frames.push({
    step: _step,
    line: lineNum,
    event: 'line',
    funcName: _callStack[_callStack.length - 1].funcName,
    locals: locals,
    stack: stack,
    returnValue: null,
    exception: null
  });
};

// Instrument and execute
try {
  var _instrumented = _instrumentCode(_userCode);
  vm.runInNewContext(_instrumented, _sandbox, {
    filename: 'user_code.js',
    timeout: TIMEOUT_MS
  });
} catch(e) {
  if (e && e.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
    _userError = { type: 'TimeoutError', message: 'Execution timed out (5s limit)' };
  } else {
    _userError = { type: (e && e.constructor && e.constructor.name) || 'Error', message: String(e && e.message || e) };
  }
}

// Capture final variable state if we have frames
if (_frames.length > 0 && !_done) {
  var finalLocals = {};
  var fkeys = Object.keys(_sandbox);
  for (var fi = 0; fi < fkeys.length; fi++) {
    var fk = fkeys[fi];
    if (_builtinKeys.has(fk)) continue;
    try {
      finalLocals[fk] = _repr(_sandbox[fk]);
    } catch(e) {
      finalLocals[fk] = '<error>';
    }
  }
  // Update the last frame's locals to reflect final state
  _frames[_frames.length - 1].locals = finalLocals;
  var lastStack = _frames[_frames.length - 1].stack;
  if (lastStack.length > 0) {
    lastStack[lastStack.length - 1].locals = finalLocals;
  }
}

// Output trace
var _output = {
  frames: _frames,
  stdout: _capturedStdout.join('\\n'),
  stderr: _capturedStderr.join('\\n'),
  error: _userError
};

process.stdout.write('---TRACE_START---\\n');
process.stdout.write(JSON.stringify(_output));
process.stdout.write('\\n---TRACE_END---\\n');
`;

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
