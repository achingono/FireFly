# Code Execution Guide

FireFly executes student code in sandboxed containers via Judge0, a code execution engine. For Python, the server injects a tracer that captures per-step execution data (line, function, locals, stack, stdout) which powers the visual code stepper.

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌───────────────┐
│  Client   │     │  Server   │     │  Judge0   │     │ Judge0 Worker │
│  (Editor) │     │ (Fastify) │     │  (API)    │     │ (Sandbox)     │
└─────┬─────┘     └─────┬─────┘     └─────┬─────┘     └───────┬───────┘
      │                  │                  │                   │
      │  1. Submit code  │                  │                   │
      ├─────────────────▶│                  │                   │
      │                  │  2. Wrap with    │                   │
      │                  │     tracer       │                   │
      │                  │  3. Submit       │                   │
      │                  ├─────────────────▶│                   │
      │                  │                  │  4. Execute       │
      │                  │                  ├──────────────────▶│
      │                  │                  │                   │
      │                  │                  │  5. Return output │
      │                  │                  │◀──────────────────│
      │                  │  6. Poll result  │                   │
      │                  ├─────────────────▶│                   │
      │                  │  7. Raw output   │                   │
      │                  │◀─────────────────│                   │
      │                  │                  │                   │
      │                  │  8. Parse trace  │                   │
      │  9. Trace data   │                  │                   │
      │◀─────────────────│                  │                   │
      │                  │                  │                   │
      │  10. Render in   │                  │                   │
      │      stepper     │                  │                   │
```

## Execution Pipeline

### Step 1: Code Submission

The client sends code to the server:

```json
POST /api/v1/execution/run
{
  "code": "x = 5\ny = 10\nprint(x + y)",
  "language": "python",
  "exerciseId": "optional-uuid"
}
```

### Step 2: Tracer Injection (Python Only)

For Python, the server wraps the user's code with a tracer script:

```python
import sys, json, io

# Redirect stdout/stderr
_old_stdout, _old_stderr = sys.stdout, sys.stderr
_captured_stdout = io.StringIO()
_captured_stderr = io.StringIO()
sys.stdout = _captured_stdout
sys.stderr = _captured_stderr

_trace_data = []
_step = [0]

def _tracer(frame, event, arg):
    if event in ('line', 'call', 'return', 'exception'):
        # Skip tracer internals
        if frame.f_code.co_filename != '<string>':
            return _tracer

        # Capture locals (exclude _ prefixed)
        locals_dict = {
            k: repr(v) for k, v in frame.f_locals.items()
            if not k.startswith('_')
        }

        # Build stack trace
        stack = []
        f = frame
        while f:
            if f.f_code.co_filename == '<string>':
                stack.append({
                    'funcName': f.f_code.co_name,
                    'line': f.f_lineno,
                    'locals': {
                        k: repr(v) for k, v in f.f_locals.items()
                        if not k.startswith('_')
                    }
                })
            f = f.f_back
        stack.reverse()

        _trace_data.append({
            'step': _step[0],
            'line': frame.f_lineno,
            'event': event,
            'funcName': frame.f_code.co_name,
            'locals': locals_dict,
            'stack': stack,
            'stdout': _captured_stdout.getvalue(),
            'stderr': _captured_stderr.getvalue(),
        })
        _step[0] += 1

    return _tracer

sys.settrace(_tracer)
try:
    # === USER CODE INSERTED HERE ===
    x = 5
    y = 10
    print(x + y)
    # === END USER CODE ===
finally:
    sys.settrace(None)
    sys.stdout = _old_stdout
    sys.stderr = _old_stderr
    print("---TRACE_START---")
    print(json.dumps(_trace_data))
    print("---TRACE_END---")
```

### Step 3: Judge0 Submission

The wrapped code is submitted to Judge0:

```json
POST http://judge0:2358/submissions?wait=false
{
  "source_code": "<wrapped-code>",
  "language_id": 71,
  "stdin": ""
}
```

**Supported language IDs**:

| Language | ID |
|----------|-----|
| Python | 71 |
| JavaScript | 63 |
| C | 50 |
| C++ | 54 |
| Java | 62 |

### Step 4–5: Sandboxed Execution

Judge0 workers execute the code in isolated Docker containers with:
- CPU and memory limits
- Time limits (configurable, default ~5 seconds)
- No network access
- No filesystem persistence

### Step 6–7: Polling for Results

The server polls Judge0 for completion:

```
GET http://judge0:2358/submissions/<token>?fields=status,stdout,stderr,exit_code
```

Polling configuration:
- Interval: 500ms
- Max attempts: 30 (15 seconds total timeout)
- Checks `status.id` for completion (id > 2 means done)

### Step 8: Trace Parsing

The server extracts trace data from stdout:

1. Finds the `---TRACE_START---` marker in stdout
2. Finds the `---TRACE_END---` marker
3. Parses the JSON between the markers
4. The actual program stdout (before the markers) is separated from trace data
5. Stores the parsed trace in the database (`ExecutionJob.trace`)

### Step 9–10: Client Rendering

The trace data is returned to the client and rendered in the visual stepper:

```json
{
  "trace": [
    {
      "step": 0,
      "line": 1,
      "event": "line",
      "funcName": "<module>",
      "locals": {},
      "stack": [{ "funcName": "<module>", "line": 1, "locals": {} }],
      "stdout": "",
      "stderr": ""
    },
    {
      "step": 1,
      "line": 2,
      "event": "line",
      "funcName": "<module>",
      "locals": { "x": "5" },
      "stack": [{ "funcName": "<module>", "line": 2, "locals": { "x": "5" } }],
      "stdout": "",
      "stderr": ""
    }
  ]
}
```

## Client-Side Trace Processing

The visualizer page (`pages/visualizer.tsx`) transforms the raw trace for display:

### parseRepr

Converts Python `repr()` strings back to JavaScript values:

| Python repr | JavaScript value | Display |
|-------------|-----------------|---------|
| `"5"` | `5` | Primitive |
| `"'hello'"` | `"hello"` | String |
| `"True"` | `true` | Boolean |
| `"[1, 2, 3]"` | `[1, 2, 3]` | List → Heap object |
| `"{'a': 1}"` | `{a: 1}` | Dict → Heap object |

### Heap Synthesis

Lists and dictionaries are extracted from locals into a separate "heap" view:

1. Scan locals for list/dict values
2. Assign stable object IDs (based on variable name + step)
3. Display as heap objects with type-colored cards:
   - Lists: show items with indexes
   - Dicts: show key-value entries
4. Locals display shows a reference pointer instead of the full value

### Frame Navigation

The stepper controls allow:
- **Step forward/backward** — Move one frame at a time
- **Play/pause** — Auto-advance at configurable speed (200ms–2000ms)
- **Jump to frame** — Click on the progress bar to jump to any step
- **Event badges** — Visual indicators for line/call/return/exception events

## Visual Stepper Layout

```
┌─────────────────────┬─────────────────────┐
│                     │                     │
│    Code Pane        │    Stack Pane       │
│    (Monaco Editor)  │    (Call Stack)     │
│    Line highlighted │    Frame locals     │
│                     │                     │
├─────────────────────┼─────────────────────┤
│                     │                     │
│    Heap Pane        │    Output Pane      │
│    (Objects)        │    (stdout/stderr)  │
│    Lists, Dicts     │    Cumulative       │
│                     │                     │
├─────────────────────┴─────────────────────┤
│                                           │
│    Stepper Controls                       │
│    [⏮] [◀] [▶/⏸] [▶] [⏭]  Speed  Step  │
│    ━━━━━━━━━━━━━━━━━━━━━━━━━  (progress)  │
│                                           │
└───────────────────────────────────────────┘
```

### Pane Details

| Pane | Component | What It Shows |
|------|-----------|---------------|
| **Code** | `code-pane.tsx` | Monaco Editor (read-only during trace), current line highlighted with yellow/green decoration |
| **Stack** | `stack-pane.tsx` | Call stack frames with Framer Motion animation. Active frame highlighted. Each frame shows function name, line, and local variables |
| **Heap** | `heap-pane.tsx` | Heap objects (lists, dicts) with type-colored cards. Color coding: blue for lists, green for dicts |
| **Output** | `output-pane.tsx` | Cumulative stdout and stderr. Shows what's been printed up to the current step |
| **Controls** | `stepper-controls.tsx` | Playback controls, clickable progress bar, step counter, speed slider, event type badges, AI explain button |

## Exercise Execution

When executing code from the exercise page:

1. Student writes code in Monaco Editor
2. Clicks "Run" button
3. Code submitted with `exerciseId` for tracking
4. On completion:
   - Stdout compared against test case `expectedOutput`
   - If all tests pass → correct attempt
   - Mastery update submitted (`POST /progress/:userId/update`)
   - Progress bar animates with BKT score change
   - If concept mastered → unlock notification shown
5. Student can click "View Trace" to open in the visual stepper

## Limitations

### Current
- **Python only** for trace generation — other languages execute but produce no trace
- **~500 step limit** — very long-running code may be truncated
- **`repr()` limitations** — complex custom objects show their repr string
- **No input support** — `input()` calls will hang; exercises use predefined test cases

### Judge0 Constraints
- Default execution time limit: ~5 seconds
- Default memory limit: ~128MB
- No network access from sandboxed code
- No persistent file system

## Troubleshooting

### "Execution failed" errors

1. Check Judge0 is running: `curl http://localhost:2358/about`
2. Check Judge0 workers: `docker compose logs judge0-workers`
3. Verify the language ID is correct for the submitted language

### Missing trace data

1. Ensure the code is Python (only language with tracing)
2. Check if the code has a syntax error (tracer won't run)
3. Look at the raw stdout — trace markers should be present
4. If stdout is empty, Judge0 may have timed out

### Trace parsing errors

The trace is extracted from stdout between `---TRACE_START---` and `---TRACE_END---`. If the user's code prints these exact strings, it could interfere with parsing.

## Related Documentation

- [Execution API](../api/execution.md) — Endpoint reference
- [Architecture Overview](../architecture/overview.md) — System-level view
- [Mastery API](../api/mastery.md) — How exercise results feed mastery
