# Backend Architecture

The FireFly server is a Node.js + Fastify application written in TypeScript. It serves the REST API, manages authentication, orchestrates code execution through Judge0, tracks mastery with BKT, and proxies AI requests to a local LLM.

## Directory Structure

```
code/server/
├── prisma/
│   ├── schema.prisma          # Database models and enums
│   ├── migrations/            # Prisma migration files
│   └── prisma.config.ts       # Prisma adapter configuration
├── src/
│   ├── index.ts               # Fastify entry point, plugin/route registration, shutdown
│   ├── config/
│   │   ├── env.ts             # Zod-validated environment variables
│   │   ├── database.ts        # PrismaClient with PrismaPg adapter
│   │   └── redis.ts           # ioredis singleton with retry logic
│   ├── plugins/
│   │   ├── auth.ts            # JWT verification, authenticate/requireRole decorators
│   │   ├── envelope.ts        # Standardized response envelope decorators
│   │   └── request-id.ts      # X-Request-Id header handling
│   └── routes/
│       ├── health.ts          # Health check endpoint
│       ├── admin.ts           # Database seeding
│       ├── auth.ts            # OIDC login, callback, session management
│       ├── curriculum.ts      # Concepts, lessons, exercises CRUD
│       ├── execution.ts       # Code execution via Judge0
│       ├── mastery.ts         # BKT progress tracking
│       └── llm.ts             # AI explain/hint/chat proxy
├── package.json
├── tsconfig.json
└── Dockerfile
```

## Entry Point (`src/index.ts`)

The server bootstraps in this order:

1. **CORS** — `@fastify/cors` allowing `CLIENT_ORIGIN` with credentials
2. **Plugins** (registered sequentially):
   - `request-id` — Attaches UUID to every request
   - `envelope` — Adds `reply.envelope()` and `reply.envelopeError()` decorators
   - `auth` — Registers JWT and cookie support, adds `authenticate` and `requireRole` decorators
3. **Routes** (registered under `/api/v1`):
   - `health`, `admin`, `auth`, `curriculum`, `execution`, `mastery`, `llm`
4. **Listen** on `PORT` (default 3000), binding to `0.0.0.0`
5. **Graceful shutdown** — Disconnects Prisma and quits Redis on SIGINT/SIGTERM

## Configuration

### Environment Variables (`config/env.ts`)

All environment variables are validated at startup using Zod with sensible defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server listen port |
| `NODE_ENV` | `development` | Runtime environment |
| `DATABASE_URL` | (required) | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JUDGE0_URL` | `http://localhost:2358` | Judge0 API base URL |
| `OIDC_ISSUER` | (required) | OIDC provider issuer URL |
| `OIDC_CLIENT_ID` | (required) | OIDC client ID |
| `OIDC_CLIENT_SECRET` | (required) | OIDC client secret |
| `OIDC_REDIRECT_URI` | (required) | OIDC callback URL |
| `JWT_SECRET` | (required) | JWT signing secret |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime |
| `LLM_PROVIDER` | `lmstudio` | LLM provider identifier |
| `LLM_BASE_URL` | `http://localhost:1234` | LLM API base URL |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |

### Database (`config/database.ts`)

Uses Prisma with the `@prisma/adapter-pg` PostgreSQL adapter:

```typescript
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

### Redis (`config/redis.ts`)

Uses `ioredis` with:
- `lazyConnect: true` — connects on first use
- Retry strategy: exponential backoff up to 3 seconds, gives up after 10 attempts
- Used for PKCE code verifier storage (10-minute TTL) and potential session/cache needs

## Plugins

### Request ID (`plugins/request-id.ts`)

- Checks for incoming `X-Request-Id` header
- Generates UUID v4 if missing
- Attaches to `request.id` and echoes in response header
- All responses include the request ID for traceability

### Response Envelope (`plugins/envelope.ts`)

Decorates `FastifyReply` with two methods:

**`reply.envelope(data, meta?)`** — Success response:
```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid-v4",
  "data": { ... },
  "meta": { "schemaVersion": "1.0", ...meta }
}
```

**`reply.envelopeError(code, type, message, details?)`** — Error response:
```json
{
  "status": "error",
  "code": 400,
  "requestId": "uuid-v4",
  "error": { "type": "ValidationError", "message": "...", "details": [...] }
}
```

### Auth (`plugins/auth.ts`)

Registers `@fastify/jwt` (using `JWT_SECRET`, cookie-based extraction) and `@fastify/cookie`.

**Decorators added to Fastify instance:**

- **`authenticate`** — `preHandler` hook that verifies JWT from cookie. On failure, returns 401.
- **`requireRole(...roles)`** — Returns a `preHandler` that checks `request.user.role` against allowed roles. Returns 403 if unauthorized.

JWT payload shape:
```typescript
{
  sub: string;       // User ID
  email: string;
  role: string;      // student | teacher | parent | admin
  ageProfile: string; // fun | balanced | pro
}
```

## Route Modules

### Health (`routes/health.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/health` | No | Returns status, timestamp, version |

### Admin (`routes/admin.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/admin/seed` | Admin | Idempotent database seed |

Seeds 5 users, 8 concepts (with prerequisite chain), 5 lessons, and 10 exercises.

### Auth (`routes/auth.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/auth/login` | No | Redirects to OIDC provider with PKCE |
| `GET` | `/api/v1/auth/callback` | No | Exchanges code, sets JWT cookies, redirects to client |
| `GET` | `/api/v1/auth/me` | Yes | Returns authenticated user profile |
| `POST` | `/api/v1/auth/refresh` | No | Refreshes JWT from cookie |
| `POST` | `/api/v1/auth/onboard` | Yes | Sets role, age, displayName, ageProfile |
| `POST` | `/api/v1/auth/logout` | No | Clears JWT cookies |

### Curriculum (`routes/curriculum.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/concepts` | Yes | List all concepts (with prerequisites) |
| `GET` | `/api/v1/concepts/:id` | Yes | Get single concept |
| `POST` | `/api/v1/concepts` | Yes (admin) | Create concept |
| `GET` | `/api/v1/lessons` | Yes | List lessons (filter by conceptId) |
| `GET` | `/api/v1/lessons/:id` | Yes | Get lesson with exercises |
| `POST` | `/api/v1/lessons` | Yes (admin) | Create lesson |
| `GET` | `/api/v1/exercises` | Yes | List exercises (filter by conceptId, difficulty, language) |
| `GET` | `/api/v1/exercises/:id` | Yes | Get single exercise |
| `POST` | `/api/v1/exercises` | Yes (admin) | Create exercise |

### Execution (`routes/execution.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/execution/run` | Yes | Submit code for execution |
| `GET` | `/api/v1/execution/jobs/:id` | Yes | Get job status |
| `GET` | `/api/v1/execution/jobs/:id/trace` | Yes | Get execution trace |

### Mastery (`routes/mastery.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/progress/:userId` | Yes | Full mastery map for user |
| `POST` | `/api/v1/progress/:userId/update` | Yes | Submit attempt, update BKT |
| `GET` | `/api/v1/progress/:userId/concept/:conceptId` | Yes | Single concept mastery detail |

### LLM (`routes/llm.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/ai/explain` | Yes | Explain code/concept |
| `POST` | `/api/v1/ai/hint` | Yes | Get hint for exercise |
| `POST` | `/api/v1/ai/chat` | Yes | Conversational AI chat |

## Error Handling

All route errors use the `reply.envelopeError()` decorator for consistent error responses. Common error patterns:

- **400** `ValidationError` — Invalid request body or query parameters
- **401** `AuthenticationError` — Missing or invalid JWT
- **403** `AuthorizationError` — Insufficient role permissions
- **404** `NotFoundError` — Resource not found
- **500** `InternalError` — Unexpected server errors

## Related Documentation

- [Architecture Overview](./overview.md)
- [Database Schema](./database.md)
- [API Overview](../api/overview.md)
- [Authentication Guide](../guides/authentication.md)
- [Code Execution Guide](../guides/code-execution.md)
