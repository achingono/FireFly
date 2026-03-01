Create a full‑stack AI‑powered coding education platform scaffold: a React + TypeScript SPA frontend and a Node.js (TypeScript) REST API backend with a standardized JSON schema for all operations. Produce working UI pages, API routes, controllers, and valid responses so the app can be run locally. Include configuration for self‑hosted Docker execution workers and a local LLM proxy endpoint. Prioritize the interactive code visualizer/stepper UI and a consistent API contract used by frontend and backend.
---
High‑level requirements
• Frontend: React + TypeScript, Vite or Next.js (static + API calls), Monaco editor embedded, visualizer components (code pane, stack pane, heap pane, output pane, stepper controls), age themes (6–9, 10–13, 14–17), teacher/parent dashboard, authentication UI (email + password + role).
• Backend: Node.js + TypeScript (Express or Fastify), OpenAPI spec, standardized JSON response envelope, authentication (JWT), role‑based access (student, teacher, admin), mock data seeding, and example controllers for all endpoints.
• Dev infra: Docker Compose for local dev (app, API, Postgres, Redis, execution worker, LLM proxy), environment variable templates, and README with run steps.
• Testing: unit tests for API routes and snapshot tests for key UI components; example Postman/Insomnia collection exported.
---
Standardized API contract (global rules)
• Response envelope — every successful response uses:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid-v4",
  "data": { /* resource or array */ },
  "meta": { /* pagination, schemaVersion, modelVersion */ }
}
```
• Error envelope — every error uses:
```json
{
  "status": "error",
  "code": 400,
  "requestId": "uuid-v4",
  "error": {
    "type": "ValidationError",
    "message": "Human readable message",
    "details": [{ "field": "email", "issue": "invalid format" }]
  }
}
```
• Pagination — use cursor pagination with meta:
```json
"meta": { "cursor": "opaque-string", "limit": 20, "hasMore": true }
```
• Timestamps — ISO 8601 UTC strings for all date fields.
• Schema versioning — include meta.schemaVersion in all responses.
• Request tracing — accept X-Request-Id header and echo in responses.
---
Core API endpoints (must generate routes, controllers, and mock responses)
Provide OpenAPI‑style definitions and example mock responses for each.
Authentication
• POST /api/v1/auth/register — body: `{email,passwordrole,age} → returns JWT and user object.
• `POST /api/v/auth/login — returns {token, user}.
• POST /api/v1/auth/refresh — refresh token flow.
Users & Profiles
• GET /api/v1/users/:id — returns user profile with ageProfile, preferences, masteryMap.
• `ATCH /api/v1/users/:id — update preferences and UI theme.
Curriculum & Concepts
• GET /api/v1/concepts — list concepts with tags, prerequisites, difficulty.
• GET /api/v1/concepts/:id — detail, canonical examples, recommended exercises.
Lessons & Exercises
• `GET /api/v1/essons/:id — lesson content, examples, media, LLM prompt templates.
• GET /api/v1/exercises/:id — exercise metadata, test cases, expected trace patterns.
• `POST /api/v1/exercises:id/submit — body: `{code, language options} → returns execution job id and immediate static checks.
Execution & Tracing
• POST /api/v1/execution/run — body: `{ode, language, stdin, timeoutMs, captureTrace:true} → returns `{jobId, status estimatedMs}.
• GET /api/v1/execution/jobs/:jobId — returns job status and final result.
• `GET /api/v1/executionjobs/:jobId/trace — returns trace object (see Trace Schema below).
• `WS /api/v1/execution/jobs/:jobd/stream — real‑time trace events for stepper playback.
Visualizer helpers
• `POST/api/v1/visualizer/transform — accept raw trace and return optimized frames for client (grouped/diffed).
• `POST /api/v1/visualizerexplain — body: {traceStep, ageProfile, tone} → returns LLM explanation.
Mastery & Progression
• `GET /api/v1/progress:userId — mastery map per concept, recent attempts.
• POST /api/v1/progress/:userId/update — update mastery after an attempt (server computes new mastery score).
Admin & Teacher
• `GET/api/v1/admin/analytics — aggregated metrics (mastery gains, common errors).
• `POST /api/v1/adminseed — seed mock curriculum and users (dev only).
---
Trace schema (canonical, compact, and versioned)
Provide a deterministic trace format the visualizer consumes. Include mock example.
```json
{
  "traceVersion": "1.0",
  "jobId": "job-uuid",
  "language": "python",
  "frames": [
    {
      "step": 1,
      "timeMs": 12,
      "file": "main.py",
      "line": 3,
      "event": "line",
      "stack": [
        { "frameId": "f1", "name": "main", "locals": { "i": 0, "arr": [1,2] } }
      ],
      "heap": [
        { "id": "o1", "type": "list", "repr": "[1,2]" }
      ],
      "stdout": "",
      "stderr": ""
    }
  ],
  "metadata": { "durationMs": 120, "maxMemoryKb": 5120 }
}
```
• Notes: frames are diffs where possible; heap objects include stable ids; include event types: call, return, line, exception, assign, io.