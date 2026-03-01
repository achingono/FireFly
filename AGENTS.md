# AGENTS.md

> Instructions for AI coding agents working on the FireFly codebase.

## Project overview

FireFly is an AI-powered, mastery-based coding education platform for kids (ages 8+). The primary feature is a **visual code stepper** that steps through execution line-by-line showing stack, heap, variables, and I/O. The platform adapts its UI to three age modes: Fun (8–10), Balanced (11–13), and Pro (14+).

The product specification is in `docs/SPEC.md`. The implementation plan with task breakdown is in `docs/implementation-plan.md`. Full documentation is in `docs/` organized by topic (architecture, API reference, guides).

## Repository structure

```
FireFly/
├── code/
│   ├── client/          # React + Vite + TypeScript SPA
│   │   ├── src/
│   │   │   ├── api/              # HTTP API client (client.ts)
│   │   │   ├── assets/           # Static assets
│   │   │   ├── components/
│   │   │   │   ├── ui/           # shadcn/ui primitives — DO NOT manually edit
│   │   │   │   ├── visualizer/   # Code stepper panes (code, stack, heap, output, controls, AI)
│   │   │   │   └── dashboard/    # Student progress widgets
│   │   │   ├── hooks/            # Custom React hooks
│   │   │   ├── lib/              # Contexts (AuthContext, ThemeContext), utilities
│   │   │   ├── pages/            # Route-level page components (8 pages)
│   │   │   └── types/            # TypeScript type definitions (domain, API, trace)
│   │   ├── vite.config.js
│   │   ├── tailwind.config.js
│   │   ├── Dockerfile
│   │   ├── nginx.conf
│   │   └── package.json
│   │
│   └── server/          # Node.js + Fastify + TypeScript API
│       ├── prisma/
│       │   ├── schema.prisma     # 8 models, 4 enums
│       │   └── migrations/       # Prisma migration files
│       ├── src/
│       │   ├── config/           # env.ts, database.ts, redis.ts
│       │   ├── plugins/          # auth.ts, envelope.ts, request-id.ts
│       │   └── routes/           # health, admin, auth, curriculum, execution, mastery, llm
│       ├── tsconfig.json
│       ├── Dockerfile
│       └── package.json
│
├── docs/
│   ├── SPEC.md                   # Product specification
│   ├── implementation-plan.md    # Task-level implementation plan
│   ├── architecture/             # System architecture docs
│   │   ├── overview.md           # System diagram, tech stack, design decisions
│   │   ├── backend.md            # Fastify server structure, plugins, routes
│   │   ├── frontend.md           # React app structure, pages, components, contexts
│   │   └── database.md           # Prisma schema, models, relationships, enums
│   ├── api/                      # API reference docs
│   │   ├── overview.md           # Envelope format, auth, error handling
│   │   ├── auth.md               # OIDC login, callback, session endpoints
│   │   ├── curriculum.md         # Concepts, lessons, exercises CRUD
│   │   ├── execution.md          # Code execution, trace format
│   │   ├── mastery.md            # BKT progress tracking
│   │   └── ai.md                 # LLM explain, hint, chat
│   └── guides/                   # How-to guides
│       ├── getting-started.md    # Setup, prerequisites, first run
│       ├── development.md        # Dev workflow, code style, adding features
│       ├── deployment.md         # Docker Compose deployment, env vars
│       ├── authentication.md     # OIDC flow, JWT tokens, onboarding
│       ├── theming.md            # Fun/Balanced/Pro modes, CSS properties
│       └── code-execution.md     # Judge0, Python tracer, trace pipeline
│
├── docker-compose.yml            # 7 services: postgres, redis, judge0, judge0-workers, oidc, server, client
├── .env.example                  # Environment variable template (17 vars)
├── AGENTS.md
├── README.md
└── LICENSE
```

## Current state

The platform is **fully implemented** across 8 development waves plus Docker deployment:

- **Wave 0**: Docker Compose infrastructure, backend scaffold, Vite proxy, full TypeScript migration, shared types
- **Wave 1**: Prisma schema with migrations, Monaco Editor integration
- **Wave 2**: Backend OIDC auth routes (PKCE), full API client rewrite
- **Wave 3**: Auth UI (login/callback/onboarding), AuthContext, protected routes
- **Wave 4**: Curriculum CRUD endpoints, Judge0 code execution with Python tracer
- **Wave 5**: Curriculum, exercise, and visualizer pages wired to real API
- **Wave 6**: Theme infrastructure (Fun/Balanced/Pro CSS), BKT mastery tracking
- **Wave 7**: Dashboard wired to real data, mastery submission loop
- **Wave 8**: AI integration (LLM proxy with age-adapted prompts)
- **Docker**: Dockerfiles for client (Nginx) and server (Node.js), complete Docker Compose deployment

All files are TypeScript (`.tsx`/`.ts`). The API client is fully implemented. The backend has working auth, database, code execution, trace generation, AI integration, and adaptive theming.

## Dev environment

### Prerequisites

- Node.js >= 20
- Docker and Docker Compose
- Git
- LM Studio (optional, for AI features)

### Quick start (Docker Compose)

```bash
cp .env.example .env
docker compose up -d
curl -X POST http://localhost:3000/api/v1/admin/seed
# Open http://localhost:80
```

### Development (hot reload)

```bash
# Start infrastructure
docker compose up -d postgres redis judge0 judge0-workers oidc

# Server
cd code/server
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev    # Fastify on http://localhost:3000

# Client (separate terminal)
cd code/client
npm install
npm run dev    # Vite on http://localhost:5173
```

### Default login credentials

- **Email**: `admin@localhost`
- **Password**: `Divide-30-Weight`

### Client commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (port 5173, proxies /api to 3000) |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | Run ESLint (quiet mode) |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run preview` | Preview production build |

### Server commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start with tsx watch (auto-reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |
| `npx prisma generate` | Regenerate Prisma client |
| `npx prisma migrate dev` | Create new migration |
| `npx prisma migrate deploy` | Apply pending migrations |
| `npx prisma studio` | Open database GUI |

### Full stack (Docker Compose)

```bash
docker compose up -d     # All 7 services
docker compose down       # Stop all
docker compose up -d --build  # Rebuild after code changes
```

## Code style and conventions

### General rules

- Use **functional components** with React hooks. No class components.
- Use `@/` path alias for all imports from `src/` (configured in `vite.config.js` and `tsconfig.json`).
- All files use **TypeScript** (`.tsx`/`.ts`).
- Prefix unused variables with `_` (ESLint enforces this).
- The project uses semicolons and double quotes.
- All timestamps must be ISO 8601 UTC strings.

### Client (React + Vite + TypeScript)

- **Component library**: shadcn/ui (New York style). Add new UI primitives via `npx shadcn@latest add <component>`. Never manually edit files in `src/components/ui/`.
- **Styling**: Tailwind CSS with CSS custom properties for theming. Colors use `hsl(var(--token))` pattern. Three theme modes: `.theme-fun`, `.theme-balanced`, `.theme-pro`.
- **State management**: React Context for global state (AuthContext, ThemeContext). TanStack Query for server state.
- **Routing**: `react-router-dom` v6. Route definitions in `src/pages.config.ts`, page components in `src/pages/`.
- **Icons**: Lucide React (`lucide-react`).
- **Animation**: Framer Motion for transitions.
- **Forms**: `react-hook-form` + `zod` for validation.
- **Code editor**: Monaco Editor (`@monaco-editor/react`).
- **File naming**: kebab-case for component files (e.g., `stepper-controls.tsx`). PascalCase for component names.
- **Theme-aware sizing**: Use `ff-text-*` and `ff-rounded` utility classes for adaptive sizing.

### Server (Node.js + Fastify + TypeScript)

- **Framework**: Fastify with TypeScript.
- **Validation**: Zod on route inputs.
- **ORM**: Prisma with PostgreSQL (`@prisma/adapter-pg`).
- **API envelope**: Every response uses `reply.envelope(data)` or `reply.envelopeError(code, type, message)`.
- **Request tracing**: `X-Request-Id` header (UUID v4, auto-generated if missing).
- **Auth**: OIDC login + JWT (access 15min + refresh 7d). Decorators: `fastify.authenticate`, `fastify.requireRole(...)`.
- **Routes**: All under `/api/v1/`.

## API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | No | Health check |
| `POST` | `/admin/seed` | No | Seed database |
| `GET` | `/auth/login` | No | Initiate OIDC login |
| `GET` | `/auth/callback` | No | OIDC callback |
| `GET` | `/auth/me` | Yes | Current user profile |
| `POST` | `/auth/refresh` | No | Refresh JWT |
| `POST` | `/auth/onboard` | Yes | Complete onboarding |
| `POST` | `/auth/logout` | No | Clear session |
| `GET` | `/concepts` | Yes | List concepts |
| `GET` | `/concepts/:id` | Yes | Get concept |
| `POST` | `/concepts` | Admin | Create concept |
| `GET` | `/lessons` | Yes | List lessons |
| `GET` | `/lessons/:id` | Yes | Get lesson with exercises |
| `POST` | `/lessons` | Admin | Create lesson |
| `GET` | `/exercises` | Yes | List exercises |
| `GET` | `/exercises/:id` | Yes | Get exercise |
| `POST` | `/exercises` | Admin | Create exercise |
| `POST` | `/execution/run` | Yes | Execute code |
| `GET` | `/execution/jobs/:id` | Yes | Job status |
| `GET` | `/execution/jobs/:id/trace` | Yes | Execution trace |
| `GET` | `/progress/:userId` | Yes | Full mastery map |
| `POST` | `/progress/:userId/update` | Yes | Submit attempt (BKT update) |
| `GET` | `/progress/:userId/concept/:conceptId` | Yes | Concept mastery detail |
| `POST` | `/ai/explain` | Yes | AI code explanation |
| `POST` | `/ai/hint` | Yes | AI exercise hint |
| `POST` | `/ai/chat` | Yes | AI conversation |

See `docs/api/` for detailed request/response documentation.

## Testing

### Client

No test framework is configured yet. When adding tests:

- Use **Vitest** + **React Testing Library** for component tests.
- Snapshot tests for visualizer panes.
- Interaction tests for stepper controls and auth forms.

### Server

When adding tests:

- Use **Vitest** for unit and integration tests.
- Test all route handlers with mock DB.
- Validate trace output and API envelope format.

### E2E

- Use **Playwright** for end-to-end smoke tests.
- Critical path: login → browse curriculum → open exercise → run code → view trace → check mastery update.

## Architecture decisions

- **Authentication**: OIDC via `ghcr.io/plainscope/simple-oidc-provider` + JWT tokens. Separates identity management from application concerns.
- **Execution engine**: Self-hosted Judge0 in Docker Compose. Python code wrapped with `sys.settrace()` tracer to capture per-step execution data.
- **Trace format**: JSON array of frames with step, line, event, funcName, locals, stack, stdout, stderr.
- **Adaptive UI**: ThemeContext drives Fun/Balanced/Pro mode via CSS custom properties on `<html>`. Pro mode additionally applies `.dark` class.
- **Mastery model**: Bayesian Knowledge Tracing per concept (pL0=0.10, pT=0.20, pG=0.25, pS=0.10). Threshold ≥ 0.80 to master + unlock dependents.
- **AI/LLM**: OpenAI-compatible API via LM Studio (localhost:1234). Three age-adapted system prompts. Hint mode prevents giving full solutions.
- **Database**: PostgreSQL (Prisma ORM) for relational data. Redis for PKCE verifier storage, sessions, caching.

## Key files to know

| File | What it does |
|------|-------------|
| `code/client/src/app.tsx` | Root component: AuthProvider → ThemeProvider → QueryClientProvider → Router |
| `code/client/src/layout.tsx` | App shell: nav bar, user display, mobile menu |
| `code/client/src/pages.config.ts` | Route definitions mapping page names to paths and components |
| `code/client/src/api/client.ts` | Full HTTP API client with auth, entities, execution, progress, AI methods |
| `code/client/src/lib/AuthContext.tsx` | Auth context: OIDC token handling, user loading, login/logout |
| `code/client/src/lib/ThemeContext.tsx` | Theme context: Fun/Balanced/Pro mode switching, CSS class management |
| `code/client/src/pages/visualizer.tsx` | Core feature: 4-pane visual stepper with trace rendering |
| `code/client/src/pages/exercise.tsx` | Exercise list + editor + execution + mastery feedback |
| `code/client/src/pages/dashboard.tsx` | Student progress dashboard with mastery map |
| `code/client/src/index.css` | Theme CSS custom properties for all three modes |
| `code/server/src/index.ts` | Server entry: Fastify setup, plugins, routes, graceful shutdown |
| `code/server/src/config/env.ts` | Zod-validated environment variables |
| `code/server/src/plugins/auth.ts` | JWT auth plugin with authenticate/requireRole decorators |
| `code/server/src/plugins/envelope.ts` | Standardized response envelope decorators |
| `code/server/src/routes/auth.ts` | OIDC login/callback, JWT tokens, onboarding |
| `code/server/src/routes/execution.ts` | Judge0 submission, polling, Python tracer, trace parsing |
| `code/server/src/routes/mastery.ts` | BKT algorithm, mastery tracking, concept unlocking |
| `code/server/src/routes/llm.ts` | AI proxy: explain, hint, chat with age-adapted prompts |
| `code/server/prisma/schema.prisma` | Database models: User, Concept, Lesson, Exercise, ExecutionJob, MasteryRecord |
| `docker-compose.yml` | 7-service stack: postgres, redis, judge0, judge0-workers, oidc, server, client |
| `docs/SPEC.md` | Product specification |
| `docs/implementation-plan.md` | Task-level work plan |

## Security considerations

- **COPPA compliance**: Parental consent required for users under 13. Never store unnecessary personal data for minors.
- **Sandboxing**: All user-submitted code executes in isolated Judge0 containers with no network access, no filesystem persistence, and strict resource limits.
- **LLM safety**: Hint mode includes instruction to never provide full solutions. AI output should pass through a moderation layer in production.
- **Auth**: OIDC for identity, JWT access tokens (15min), refresh tokens (7d) as httpOnly cookies. PKCE for authorization code exchange.
- **Input validation**: Validate all inputs server-side with Zod. Never trust client-provided data.
- **Rate limiting**: Apply per-user rate limits on execution (10/min) and LLM (20/min) endpoints in production.

## PR and commit guidelines

- Commit messages: imperative mood, concise. E.g., `Add JWT auth middleware`, `Wire curriculum page to real API`.
- PR title format: `[area] Description` — e.g., `[server] Add auth routes`, `[client] Replace textarea with Monaco editor`.
- Run `npm run lint` in `code/client/` before committing client changes.
- Run `npm run build` in `code/server/` before committing server changes.
- All CI checks must pass before merging.

## Documentation

Comprehensive documentation is available in `docs/`:

| Section | Path | Description |
|---------|------|-------------|
| Architecture | `docs/architecture/` | System overview, backend, frontend, database |
| API Reference | `docs/api/` | Endpoints, request/response shapes, envelope format |
| Guides | `docs/guides/` | Getting started, development, deployment, auth, theming, execution |
