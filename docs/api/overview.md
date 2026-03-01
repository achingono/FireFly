# API Overview

All FireFly API endpoints are served under the `/api/v1` prefix. The server uses a standardized envelope format for all responses, JWT-based authentication, and consistent error handling.

## Base URL

```
Development: http://localhost:3000/api/v1
Production:  http://<host>/api/v1    (proxied via Nginx)
```

In development, the Vite dev server proxies `/api` requests to the Fastify server on port 3000.

## Response Envelope

Every API response follows a standardized envelope format.

### Success Response

```json
{
  "status": "success",
  "code": 200,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    // Response payload
  },
  "meta": {
    "schemaVersion": "1.0"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"success"` | Always `"success"` for 2xx responses |
| `code` | `number` | HTTP status code |
| `requestId` | `string` | UUID v4 for request tracing |
| `data` | `object` | Response payload (varies by endpoint) |
| `meta` | `object` | Metadata including schema version |

### Error Response

```json
{
  "status": "error",
  "code": 400,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "error": {
    "type": "ValidationError",
    "message": "Invalid request body",
    "details": [
      { "field": "email", "issue": "must be a valid email address" }
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"error"` | Always `"error"` for non-2xx responses |
| `code` | `number` | HTTP status code |
| `requestId` | `string` | UUID v4 for request tracing |
| `error.type` | `string` | Error category |
| `error.message` | `string` | Human-readable description |
| `error.details` | `array?` | Optional array of field-level errors |

### Common Error Types

| Type | Code | Description |
|------|------|-------------|
| `ValidationError` | 400 | Invalid request body or query parameters |
| `AuthenticationError` | 401 | Missing or invalid JWT token |
| `AuthorizationError` | 403 | Insufficient role permissions |
| `NotFoundError` | 404 | Requested resource does not exist |
| `InternalError` | 500 | Unexpected server error |

## Authentication

Most endpoints require JWT authentication. The server issues JWT tokens as httpOnly cookies during the OIDC login flow.

### Token Types

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| Access token | 15 minutes | httpOnly cookie (`token`) | Request authentication |
| Refresh token | 7 days | httpOnly cookie (`refreshToken`) | Token renewal |

### Protected Endpoints

All endpoints except the following require authentication:

- `GET /api/v1/health`
- `POST /api/v1/admin/seed`
- `GET /api/v1/auth/login`
- `GET /api/v1/auth/callback`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

### Role-Based Access

Some endpoints require specific roles:

| Role | Access |
|------|--------|
| `student` | All read endpoints, execution, mastery, AI |
| `teacher` | Same as student + class overview |
| `parent` | View child's progress |
| `admin` | Full access including create/seed operations |

### JWT Payload

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "student",
  "ageProfile": "balanced",
  "iat": 1700000000,
  "exp": 1700000900
}
```

## Request Tracing

Every request is assigned a UUID v4 request ID:

1. If the client sends an `X-Request-Id` header, that value is used
2. Otherwise, the server generates a new UUID v4
3. The request ID is included in:
   - The response body (`requestId` field)
   - The `X-Request-Id` response header

This enables end-to-end request tracing across client and server logs.

## Content Type

All request and response bodies use `application/json`.

## Endpoint Summary

### Health & Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | No | Health check |
| `POST` | `/admin/seed` | No | Seed database |

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/auth/login` | No | Initiate OIDC login |
| `GET` | `/auth/callback` | No | OIDC callback handler |
| `GET` | `/auth/me` | Yes | Get current user |
| `POST` | `/auth/refresh` | No | Refresh JWT tokens |
| `POST` | `/auth/onboard` | Yes | Complete onboarding |
| `POST` | `/auth/logout` | No | Clear session |

### Curriculum

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/concepts` | Yes | List concepts |
| `GET` | `/concepts/:id` | Yes | Get concept |
| `POST` | `/concepts` | Admin | Create concept |
| `GET` | `/lessons` | Yes | List lessons |
| `GET` | `/lessons/:id` | Yes | Get lesson with exercises |
| `POST` | `/lessons` | Admin | Create lesson |
| `GET` | `/exercises` | Yes | List exercises |
| `GET` | `/exercises/:id` | Yes | Get exercise |
| `POST` | `/exercises` | Admin | Create exercise |

### Code Execution

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/execution/run` | Yes | Submit code for execution |
| `GET` | `/execution/jobs/:id` | Yes | Get job status |
| `GET` | `/execution/jobs/:id/trace` | Yes | Get execution trace |

### Mastery & Progress

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/progress/:userId` | Yes | Full mastery map |
| `POST` | `/progress/:userId/update` | Yes | Submit attempt |
| `GET` | `/progress/:userId/concept/:conceptId` | Yes | Concept detail |

### AI / LLM

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/ai/explain` | Yes | Explain code/concept |
| `POST` | `/ai/hint` | Yes | Get exercise hint |
| `POST` | `/ai/chat` | Yes | Conversational AI |

## Detailed API References

- [Authentication API](./auth.md)
- [Curriculum API](./curriculum.md)
- [Execution API](./execution.md)
- [Mastery API](./mastery.md)
- [AI API](./ai.md)
