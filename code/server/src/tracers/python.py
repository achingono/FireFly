import sys, json, base64
from io import StringIO

_USER_CODE_FILENAME = '<user_code>'

_trace_frames = []
_step = 0
_start = None
_MAX_FRAMES = 500

# Tracer-internal names that should never appear as user variables
_TRACER_INTERNALS = frozenset({
    '_trace_frames', '_step', '_start', '_MAX_FRAMES', '_TRACER_INTERNALS',
    '_tracer', '_captured_stdout', '_captured_stderr', '_orig_stdout',
    '_orig_stderr', '_builtin_names', '_user_code', '_user_error',
    '_USER_CODE_FILENAME', '_collect_locals', '_build_stack',
})


def _collect_locals(f_locals):
    local_vars = {}
    for k, v in f_locals.items():
        if k in _TRACER_INTERNALS or k in _builtin_names:
            continue
        try:
            local_vars[k] = repr(v)
        except Exception:
            local_vars[k] = '<unprintable>'
    return local_vars


def _build_stack(frame):
    stack = []
    f = frame
    while f:
        if f.f_code.co_filename == _USER_CODE_FILENAME:
            stack.append({
                "funcName": f.f_code.co_name,
                "line": f.f_lineno,
                "locals": _collect_locals(f.f_locals),
            })
        f = f.f_back
    stack.reverse()
    return stack


def _tracer(frame, event, arg):
    global _step, _start
    if frame.f_code.co_filename != _USER_CODE_FILENAME:
        return _tracer
    if _start is None:
        _start = frame.f_lineno
    if len(_trace_frames) >= _MAX_FRAMES:
        return _tracer
    if event in ('line', 'call', 'return', 'exception'):
        _step += 1
        _trace_frames.append({
            "step": _step,
            "line": frame.f_lineno,
            "event": event,
            "funcName": frame.f_code.co_name,
            "locals": _collect_locals(frame.f_locals),
            "stack": _build_stack(frame),
            "returnValue": repr(arg) if event == 'return' else None,
            "exception": str(arg[1]) if event == 'exception' and arg else None,
        })
    return _tracer


# Capture stdout/stderr
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
    exec(compile(_user_code, _USER_CODE_FILENAME, 'exec'))
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
