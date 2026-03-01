# AI API

The AI API provides age-adapted code explanations, exercise hints, and conversational chat powered by a local LLM (LM Studio) via the OpenAI-compatible `/v1/chat/completions` endpoint. All responses are tailored to the user's age profile (fun, balanced, or pro).

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `lmstudio` | LLM provider identifier |
| `LLM_BASE_URL` | `http://localhost:1234` | OpenAI-compatible API base URL |

The server connects to any OpenAI-compatible API. By default, it uses LM Studio running locally. No API key is required for LM Studio.

## Age-Adapted System Prompts

Each endpoint uses a system prompt tailored to the user's age profile:

### Fun Mode (ages 8–10)
> You are a friendly coding buddy for young kids learning to code. Use simple words, short sentences, and fun emojis. Keep explanations to 2–3 sentences. Be encouraging and excited about their learning!

### Balanced Mode (ages 11–13)
> You are a helpful coding tutor for middle-school students. Give clear, step-by-step explanations. Use analogies when helpful. Keep a warm but educational tone.

### Pro Mode (ages 14+)
> You are a concise coding mentor for teenagers. Use proper CS terminology. Be direct and technical. Reference documentation conventions when relevant.

## Endpoints

### `POST /api/v1/ai/explain`

Get an AI explanation of code or a concept.

**Authentication**: Required

**Request Body**:
```json
{
  "code": "for i in range(5):\n    print(i)",
  "context": "The user is on step 3 of execution, learning about loops",
  "mode": "balanced"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | Yes | Code snippet to explain |
| `context` | `string` | No | Additional context about what the user is doing |
| `mode` | `string` | No | Age profile override: `fun`, `balanced`, `pro` (defaults to user's profile) |

**LLM Parameters**:
- Max tokens: 512
- Temperature: 0.7

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "explanation": "This code uses a **for loop** to count from 0 to 4. The `range(5)` creates a sequence of numbers [0, 1, 2, 3, 4], and each time through the loop, the variable `i` takes the next number. The `print(i)` shows each number on a new line.",
    "mode": "balanced"
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**How it's used in the UI**:
The visual stepper has an "Explain" button that sends the current code and execution context. The explanation appears in a slide-up panel (`ai-explain-panel.tsx`) with the age profile badge displayed.

---

### `POST /api/v1/ai/hint`

Get a hint for an exercise without revealing the full solution.

**Authentication**: Required

**Request Body**:
```json
{
  "code": "def add(a, b):\n    # stuck here",
  "exerciseTitle": "Sum Two Numbers",
  "exerciseDescription": "Write a function that returns the sum of two numbers",
  "mode": "fun"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | Yes | Student's current code |
| `exerciseTitle` | `string` | Yes | Exercise title for context |
| `exerciseDescription` | `string` | Yes | Exercise instructions |
| `mode` | `string` | No | Age profile override |

**LLM Parameters**:
- Max tokens: 256
- Temperature: 0.8

**Additional instruction** appended to system prompt:
> "Give a helpful hint that guides the student toward the solution without giving the answer directly. Never provide the complete solution."

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "hint": "Great start! 🎉 You have a function with two numbers `a` and `b`. Think about what math symbol puts numbers together! Can you use `return` to send the answer back?",
    "mode": "fun"
  },
  "meta": { "schemaVersion": "1.0" }
}
```

**How it's used in the UI**:
The exercise page has a "Hint" button that sends the student's current code along with exercise details. The hint appears inline below the editor.

---

### `POST /api/v1/ai/chat`

Conversational AI chat with message history.

**Authentication**: Required

**Request Body**:
```json
{
  "message": "What's the difference between a list and a tuple?",
  "history": [
    { "role": "user", "content": "What is a list in Python?" },
    { "role": "assistant", "content": "A list is an ordered collection of items..." }
  ],
  "mode": "pro"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `string` | Yes | Current user message |
| `history` | `array` | No | Previous messages (last 10 used) |
| `history[].role` | `string` | Yes | `"user"` or `"assistant"` |
| `history[].content` | `string` | Yes | Message text |
| `mode` | `string` | No | Age profile override |

**LLM Parameters**:
- Max tokens: 1024
- Temperature: 0.7

**Message construction**:
1. System prompt (age-adapted)
2. Last 10 messages from history (alternating user/assistant)
3. Current user message

**Response**:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid",
  "data": {
    "reply": "Lists and tuples are both sequences, but lists are mutable (`list.append()`, `list[0] = x`) while tuples are immutable once created. Use lists for collections that change and tuples for fixed records like coordinates `(x, y)`.",
    "mode": "pro"
  },
  "meta": { "schemaVersion": "1.0" }
}
```

## Error Handling

All AI endpoints return errors when the LLM is unavailable:

| Code | Type | Condition |
|------|------|-----------|
| 400 | `ValidationError` | Missing required fields |
| 500 | `InternalError` | LLM request failed (connection refused, timeout) |
| 500 | `InternalError` | Invalid LLM response format |

**Note**: The AI endpoints require LM Studio (or another OpenAI-compatible server) to be running. If the LLM server is not available, requests will fail with a 500 error. The rest of the application continues to function without AI features.

## LLM Request Format

The server sends requests in the OpenAI chat completion format:

```json
{
  "model": "default",
  "messages": [
    { "role": "system", "content": "You are a friendly coding buddy..." },
    { "role": "user", "content": "Explain this code: ..." }
  ],
  "max_tokens": 512,
  "temperature": 0.7
}
```

The `model` field is set to `"default"` — LM Studio uses whatever model is currently loaded.

## Related Documentation

- [API Overview](./overview.md)
- [Theming Guide](../guides/theming.md) — How age modes affect the UI
- [Frontend Architecture](../architecture/frontend.md) — AI panel components
