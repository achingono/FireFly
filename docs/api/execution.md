# Execution API

The execution API handles code submission, sandboxed execution via Judge0, and trace generation for the visual stepper. Currently supports Python with a built-in `sys.settrace()` tracer that captures per-step execution data.

## Endpoints

### `POST /api/v1/execution/run`

Submit code for execution with trace generation.

**Authentication**: Required

**Request Body**:
```json
{
  "code": "x = 5\ny = 10\nprint(x + y)",
  "language": "python",
  "exerciseId": "uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | Yes | Source code to execute |
| `language` | `string` | Yes | Programming language |
| `exerciseId` | `string` | No | Associated exercise ID |

**Supported Languages**:

| Language | Judge0 ID |
|----------|-----------|
| `python` | 71 |
| `javascript` | 63 |
| `c` | 50 |
| `cpp` | 54 |
| `java` | 62 |

> **Note**: Only Python currently supports trace generation. Other languages execute but return output without trace data.

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "id": "job-uuid",
    "status": "completed",
    "stdout": "15\n",
    "stderr": null,
    "exitCode": 0,
    "trace": [
      {
        "step": 0,
        "line": 1,
        "event": "line",
        "funcName": "<module>",
        "locals": {},
        "stack": [
          { "funcName": "<module>", "line": 1, "locals": {} }
        ],
        "stdout": "",
        "stderr": ""
      },
      {
        "step": 1,
        "line": 2,
        "event": "line",
        "funcName": "<module>",
        "locals": { "x": 5 },
        "stack": [
          { "funcName": "<module>", "line": 2, "locals": { "x": 5 } }
        ],
        "stdout": "",
        "stderr": ""
      },
      {
        "step": 2,
        "line": 3,
        "event": "line",
        "funcName": "<module>",
        "locals": { "x": 5, "y": 10 },
        "stack": [
          { "funcName": "<module>", "line": 3, "locals": { "x": 5, "y": 10 } }
        ],
        "stdout": "",
        "stderr": ""
      }
    ]
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**Execution Flow**:
1. Creates an `ExecutionJob` record in the database (status: `queued`)
2. For Python: wraps the user code with the tracer script (see below)
3. Submits the wrapped code to Judge0 via `POST /submissions?wait=false`
4. Polls Judge0 `GET /submissions/:token` every 500ms (up to 30 attempts)
5. On completion:
   - Parses trace output from stdout (between `---TRACE_START---` and `---TRACE_END---` markers)
   - Updates the execution job with stdout, stderr, exit code, and parsed trace
   - Returns the complete result

**Error Responses**:

| Code | Type | Condition |
|------|------|-----------|
| 400 | `ValidationError` | Missing code or language |
| 500 | `InternalError` | Judge0 submission failed |
| 500 | `InternalError` | Judge0 polling timed out |

---

### `GET /api/v1/execution/jobs/:id`

Get the status and result of an execution job.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Execution job UUID |

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "exerciseId": "uuid",
    "language": "python",
    "sourceCode": "x = 5\nprint(x)",
    "status": "completed",
    "judge0Id": "token-string",
    "stdout": "5\n",
    "stderr": null,
    "exitCode": 0,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:05.000Z"
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**Job Status Values**:

| Status | Description |
|--------|-------------|
| `queued` | Submitted to Judge0, waiting for execution |
| `running` | Currently executing |
| `completed` | Finished successfully |
| `failed` | Execution error (runtime error, compilation error) |
| `timeout` | Exceeded time limit |

**Error Responses**:

| Code | Type | Condition |
|------|------|-----------|
| 404 | `NotFoundError` | Job not found |

---

### `GET /api/v1/execution/jobs/:id/trace`

Get the execution trace for a completed job. This is the data consumed by the visual stepper.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Execution job UUID |

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
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
      }
    ]
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**Error Responses**:

| Code | Type | Condition |
|------|------|-----------|
| 404 | `NotFoundError` | Job not found |
| 404 | `NotFoundError` | No trace data available |

## Trace Frame Schema

Each frame in the trace array represents one step of execution:

| Field | Type | Description |
|-------|------|-------------|
| `step` | `number` | Zero-based step index |
| `line` | `number` | Source code line number (1-based) |
| `event` | `string` | Event type: `line`, `call`, `return`, `exception` |
| `funcName` | `string` | Current function name (`<module>` for top-level) |
| `locals` | `object` | Local variable values at this step |
| `stack` | `array` | Full call stack with per-frame locals |
| `stdout` | `string` | Cumulative stdout up to this step |
| `stderr` | `string` | Cumulative stderr up to this step |

### Stack Frame Schema

Each entry in the `stack` array:

| Field | Type | Description |
|-------|------|-------------|
| `funcName` | `string` | Function name |
| `line` | `number` | Current line in this frame |
| `locals` | `object` | Local variables in this frame |

## Python Tracer

The server wraps Python code with a tracer script before submitting to Judge0. The tracer uses `sys.settrace()` to capture execution events.

### How It Works

1. User's code is embedded in a wrapper script
2. The wrapper redirects `sys.stdout` and `sys.stderr` to `StringIO` buffers
3. `sys.settrace()` callback fires on every line/call/return/exception event
4. For each event, the tracer captures:
   - Step number (auto-incrementing)
   - Current line number
   - Event type
   - Function name
   - Local variables (via `repr()`, excluding `_`-prefixed names)
   - Full stack trace with per-frame locals
   - Cumulative stdout/stderr
5. Trace data is serialized as JSON between delimiters:
   ```
   ---TRACE_START---
   [{"step": 0, "line": 1, ...}, ...]
   ---TRACE_END---
   ```
6. The server parses the JSON between these markers

### Limitations

- Only Python is supported for tracing (other languages execute without trace)
- Maximum ~500 steps to prevent excessive output
- Variables are captured via `repr()` — complex objects show their string representation
- Internal tracer variables are excluded from the locals capture

## Client-Side Trace Processing

The visualizer page transforms the backend trace format for display:

1. **`parseRepr`**: Converts Python `repr()` strings to JavaScript values (e.g., `"[1, 2, 3]"` → array)
2. **Heap synthesis**: Extracts list and dict variables from locals into a separate heap view with stable object IDs
3. **Step navigation**: Allows forward/backward stepping through frames, with play/pause auto-advance

## Related Documentation

- [API Overview](./overview.md)
- [Code Execution Guide](../guides/code-execution.md)
- [Architecture Overview](../architecture/overview.md)
