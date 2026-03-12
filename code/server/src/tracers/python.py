import sys, json, base64

_trace_frames = []
_step = 0
_start = None
_MAX_FRAMES = 500

# Tracer-internal names that should never appear as user variables
_TRACER_INTERNALS = frozenset({
    '_trace_frames', '_step', '_start', '_MAX_FRAMES', '_TRACER_INTERNALS',
    '_tracer', '_captured_stdout', '_captured_stderr', '_orig_stdout',
    '_orig_stderr', '_builtin_names', '_user_code', '_user_error',
})

def _tracer(frame, event, arg):
    global _step, _start
    filename = frame.f_code.co_filename
    if filename != '<user_code>':
        return _tracer
    if _start is None:
        _start = frame.f_lineno

    if len(_trace_frames) >= _MAX_FRAMES:
        return _tracer

    if event in ('line', 'call', 'return', 'exception'):
        _step += 1
        # Collect locals — skip tracer internals and builtins only
        local_vars = {}
        for k, v in frame.f_locals.items():
            if k in _TRACER_INTERNALS or k in _builtin_names:
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
                    "locals": {k: repr(v) for k, v in f.f_locals.items() if k not in _TRACER_INTERNALS and k not in _builtin_names}
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

_builtin_names = set(dir()) | _TRACER_INTERNALS
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
