# Architecture Overview

FireFly is an AI-powered, mastery-based coding education platform for kids ages 8+. It features a visual code stepper that steps through execution line-by-line, showing stack, heap, variables, and I/O. The platform adapts its UI to three age modes: Fun (8–10), Balanced (11–13), and Pro (14+).

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose                           │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────────┐  │
│  │  Client   │    │  Server   │    │       Judge0             │  │
│  │  (Nginx)  │───▶│ (Fastify) │───▶│  (Code Execution)       │  │
│  │  :80      │    │  :3000    │    │  :2358                   │  │
│  └──────────┘    └────┬──┬───┘    │  ┌──────────────────┐    │  │
│                       │  │        │  │  Judge0 Workers   │    │  │
│                       │  │        │  │  (Sandboxed)      │    │  │
│                       │  │        └──┴──────────────────┴────┘  │
│                       │  │                                      │
│               ┌───────┘  └────────┐                             │
│               ▼                   ▼                             │
│  ┌──────────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │   PostgreSQL      │  │    Redis      │  │  OIDC Provider │   │
│  │   :5432           │  │    :6379      │  │  :9000         │   │
│  └──────────────────┘  └──────────────┘  └────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   LM Studio      │
                    │   (AI/LLM)       │
                    │   :1234          │
                    └──────────────────┘
```

## Services

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| **Client** | React + Vite (Nginx in prod) | 80 (prod) / 5173 (dev) | Single-page application |
| **Server** | Node.js + Fastify + TypeScript | 3000 | REST API |
| **PostgreSQL** | PostgreSQL 16 | 5432 | Primary database (Prisma ORM) |
| **Redis** | Redis 7 Alpine | 6379 | Session store, PKCE verifier cache, job queues |
| **Judge0** | Judge0 CE | 2358 | Sandboxed code execution engine |
| **Judge0 Workers** | Judge0 CE | — | Execution workers (Docker-in-Docker) |
| **OIDC Provider** | simple-oidc-provider | 9000 | Authentication (OpenID Connect) |
| **LM Studio** | Local LLM server | 1234 | AI features (explain, hint, chat) — runs on host |

## Tech Stack

### Frontend
- **React 18** with TypeScript (`.tsx`)
- **Vite** for bundling and dev server
- **Tailwind CSS** with CSS custom properties for adaptive theming
- **shadcn/ui** (New York style) — 47 UI primitives
- **Monaco Editor** for code editing
- **TanStack Query** for server state management
- **React Router v6** for client-side routing
- **Framer Motion** for animations
- **Lucide React** for icons
- **react-hook-form** + **Zod** for form handling

### Backend
- **Fastify** with TypeScript
- **Prisma** ORM with PostgreSQL adapter (`@prisma/adapter-pg`)
- **@fastify/jwt** + **@fastify/cookie** for JWT authentication
- **ioredis** for Redis connectivity
- **Zod** for request validation

### Infrastructure
- **Docker Compose** orchestrating 7 services
- **Judge0 CE** for sandboxed code execution
- **simple-oidc-provider** (`ghcr.io/plainscope/simple-oidc-provider`) for OIDC auth
- **LM Studio** (OpenAI-compatible API) for local AI inference

## Key Design Decisions

### Authentication: OIDC + Local Profiles
Instead of managing usernames/passwords directly, FireFly delegates authentication to an OIDC provider. After OIDC login, users complete an onboarding step to set their role, age, display name, and age profile (fun/balanced/pro). This separates identity management from application concerns.

### Code Execution: Judge0 with Python Tracer
Student code is wrapped with a Python `sys.settrace()` tracer before submission to Judge0. The tracer captures per-step execution data (line, event, locals, stack) delimited by markers. The server parses the trace output to produce the structured trace format consumed by the visual stepper.

### Adaptive Theming: CSS Custom Properties
Three age-appropriate modes (Fun, Balanced, Pro) are implemented via CSS custom properties on the `<html>` element. Each mode adjusts colors, font sizes, border radii, and component behavior. Pro mode additionally applies a dark theme.

### Mastery Tracking: Bayesian Knowledge Tracing
Student progress uses BKT to estimate knowledge probability per concept. The algorithm updates on each exercise attempt and automatically unlocks new concepts when prerequisites are mastered (threshold ≥ 0.80).

### AI Integration: Local LLM via LM Studio
AI features (explain code, give hints, chat) use an OpenAI-compatible `/v1/chat/completions` endpoint served by LM Studio running locally. System prompts are age-adapted per mode.

## Data Flow

### Code Execution Flow
1. Student writes code in Monaco Editor
2. Client sends code to `POST /api/v1/execution/run`
3. Server wraps code with Python tracer
4. Wrapped code submitted to Judge0 via REST API
5. Server polls Judge0 for completion
6. Trace output parsed from stdout markers
7. Structured trace returned to client
8. Visual stepper renders trace frame-by-frame

### Authentication Flow
1. Browser navigates to `GET /api/v1/auth/login`
2. Server builds OIDC authorization URL with PKCE (S256)
3. Code verifier stored in Redis (10-minute TTL)
4. Browser redirected to OIDC provider
5. User authenticates → redirected to callback
6. Server exchanges authorization code for tokens
7. User upserted in database from ID token claims
8. JWT access (15min) + refresh (7d) tokens set as httpOnly cookies
9. Browser redirected to client with token in URL
10. Client stores token, completes onboarding if needed

### Mastery Update Flow
1. Student submits exercise attempt
2. Server applies BKT formula to update knowledge probability
3. If probability crosses 0.80 threshold → concept mastered
4. Server checks if newly mastered concept unlocks prerequisites for other concepts
5. Newly unlocked concepts returned to client
6. Dashboard updates with progress and unlock notifications

## Related Documentation

- [Backend Architecture](./backend.md)
- [Frontend Architecture](./frontend.md)
- [Database Schema](./database.md)
- [API Overview](../api/overview.md)
- [Getting Started Guide](../guides/getting-started.md)
- [Deployment Guide](../guides/deployment.md)
