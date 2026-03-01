# AGENTS.md

> Instructions for AI coding agents working on the FireFly codebase.

## Project overview

FireFly is an AI-powered, mastery-based coding education platform for kids (ages 8+). The primary feature is a **visual code stepper** that steps through execution line-by-line showing stack, heap, variables, and I/O. The platform adapts its UI to three age modes: Fun (8–10), Balanced (11–13), and Pro (14+).

The product specification is in `docs/SPEC.md`. The implementation plan with task breakdown is in `docs/implementation-plan.md`. Always read both before starting significant work.

## Repository structure

```
FireFly/
├── code/
│   ├── client/          # React + Vite SPA (currently JSX, migrating to TypeScript)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/           # shadcn/ui primitives — DO NOT manually edit
│   │   │   │   ├── visualizer/   # Code stepper panes (code, stack, heap, output, controls)
│   │   │   │   └── dashboard/    # Student progress widgets
│   │   │   ├── pages/            # Route-level page components
│   │   │   ├── lib/              # Contexts, auth, utilities
│   │   │   ├── hooks/            # Custom React hooks
│   │   │   ├── api/              # API client (currently a stub — needs rewrite)
│   │   │   └── assets/           # Static assets
│   │   ├── vite.config.js
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   └── server/          # Node.js + Fastify + TypeScript API (EMPTY — needs scaffolding)
│
├── docs/
│   ├── SPEC.md                    # Single source of truth — consolidated product spec
│   ├── implementation-plan.md  # Task-level implementation plan with phases
│
├── AGENTS.md
├── README.md
└── LICENSE
```

## Current state

The client has a UI shell with 7 pages, 50+ shadcn/ui components, and fully-built visualizer display panes — but **everything uses hardcoded mock data**. The backend (`code/server/`) is empty. There is no working auth, database, code execution, trace generation, AI integration, or adaptive theming. The API client at `code/client/src/api/client.js` is a stub that returns a config object with no methods. See `docs/implementation-plan.md` § "Current State Assessment" for the full gap analysis.

## Dev environment

### Prerequisites

- Node.js >= 20
- Docker and Docker Compose
- Git

### Client setup

```bash
cd code/client
npm install
npm run dev        # Starts Vite dev server on http://localhost:5173
```

### Client commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | Run ESLint (quiet mode) |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run preview` | Preview production build |

### Server setup (once scaffolded)

```bash
cd code/server
npm install
npm run dev        # Starts Fastify on http://localhost:3000
```

### Full stack (once Docker Compose exists)

```bash
docker compose up -d   # Postgres, Redis, Judge0, API, Client
```

## Code style and conventions

### General rules

- Use **functional components** with React hooks. No class components.
- Use `@/` path alias for all imports from `src/` (configured in `vite.config.js` and `jsconfig.json`).
- Prefix unused variables with `_` (ESLint enforces this).
- No semicolons and single quotes are NOT enforced — the project uses semicolons and double quotes.
- All timestamps must be ISO 8601 UTC strings.

### Client (React + Vite)

- **Component library**: shadcn/ui (New York style). Add new UI primitives via `npx shadcn@latest add <component>`. Never manually edit files in `src/components/ui/`.
- **Styling**: Tailwind CSS with CSS custom properties for theming. Colors use `hsl(var(--token))` pattern. See `tailwind.config.js` and `src/index.css`.
- **State management**: React Context for global state (auth, theme). TanStack Query (`@tanstack/react-query`) for server state.
- **Routing**: `react-router-dom` v6. Route definitions in `src/pages.config.js`, page components in `src/pages/`.
- **Icons**: Lucide React (`lucide-react`).
- **Animation**: Framer Motion for transitions. PixiJS for 2D sprite animations (Fun mode). Three.js for 3D visualizations (Pro mode).
- **Forms**: `react-hook-form` + `zod` for validation.
- **File naming**: kebab-case for component files (e.g., `stepper-controls.jsx`). PascalCase for component names.
- **Current files are `.jsx`/`.js`** — the plan is to migrate to `.tsx`/`.ts`. When creating new files, use TypeScript (`.tsx`/`.ts`).

### Server (Node.js + Fastify + TypeScript)

The server does not exist yet. When building it, follow these conventions from `docs/SPEC.md`:

- **Framework**: Fastify with TypeScript.
- **Validation**: Zod or JSON Schema on all route inputs.
- **ORM**: Prisma with PostgreSQL.
- **API envelope**: Every response must use the standardized envelope:
  ```json
  {
    "status": "success",
    "code": 200,
    "requestId": "uuid-v4",
    "data": {},
    "meta": { "schemaVersion": "1.0" }
  }
  ```
- **Error envelope**:
  ```json
  {
    "status": "error",
    "code": 400,
    "requestId": "uuid-v4",
    "error": { "type": "ValidationError", "message": "...", "details": [] }
  }
  ```
- **Request tracing**: Accept `X-Request-Id` header, generate UUID v4 if missing, echo in response.
- **Auth**: JWT (access + refresh tokens). Middleware attaches `request.user`. Role-based access: student, teacher, parent, admin.
- **Pagination**: Cursor-based with `meta.cursor`, `meta.limit`, `meta.hasMore`.
- **Routes**: All under `/api/v1/`. See SPEC.md §11 for the full endpoint list.

## Testing

### Client

No test framework is configured yet. When adding tests:

- Use **Vitest** + **React Testing Library** for component tests.
- Snapshot tests for visualizer panes (`code-pane`, `stack-pane`, `heap-pane`, `output-pane`).
- Interaction tests for stepper controls and auth forms.

### Server

When adding tests:

- Use **Vitest** for unit and integration tests.
- Test all route handlers with mock DB.
- Validate trace output against the schema in SPEC.md §12.
- Validate API responses match the envelope format.

### E2E

- Use **Playwright** for end-to-end smoke tests.
- Critical path: register → login → browse curriculum → open exercise → run code → view trace → check mastery update.

## Architecture decisions

- **Execution engine**: Self-hosted Judge0 (primary). OneCompiler API as SaaS fallback. All student code runs in isolated Docker containers with strict CPU/memory/time limits and no network access.
- **Trace format**: Canonical JSON schema (SPEC.md §12). Frames include: step, timeMs, file, line, event type (line/call/return/exception/assign/io), stack frames with locals, heap objects with stable IDs, stdout/stderr.
- **Adaptive UI**: React Context (`ThemeContext`) drives Fun/Balanced/Pro mode. Tailwind CSS custom properties switch palettes. Components accept a `mode` prop for variant rendering.
- **Mastery model**: Bayesian Knowledge Tracing per concept. Threshold ≥ 0.80 + transfer check to unlock next concept.
- **AI/LLM**: Pluggable provider (OpenAI default, Anthropic, local Llama). All prompts include `{userAge}` and `{mode}` for tone calibration. Responses cached in Redis.
- **Database**: PostgreSQL for relational data. Redis for sessions, caching, job queues.

## Key files to know

| File | What it does |
|------|-------------|
| `code/client/src/app.jsx` | Root component: AuthProvider → QueryClientProvider → Router |
| `code/client/src/layout.jsx` | App shell: nav bar, user display, mobile menu |
| `code/client/src/pages.config.js` | Route definitions mapping page names to paths and components |
| `code/client/src/api/client.js` | **STUB** — needs full rewrite to real HTTP client |
| `code/client/src/lib/AuthContext.jsx` | Auth context — imports missing `@firefly/sdk` that must be removed |
| `code/client/src/pages/visualizer.jsx` | Core feature page: 4-pane stepper with mock execution |
| `code/client/src/components/visualizer/mock-trace.jsx` | 10-frame hardcoded bubble sort trace |
| `code/client/src/components/visualizer/stepper-controls.jsx` | Play/pause/step controls for the trace stepper |
| `docs/SPEC.md` | **Read this first** — consolidated product specification |
| `docs/implementation-plan.md` | Task-level work plan with phases and acceptance criteria |

## Known issues and traps

1. **`@firefly/sdk` does not exist.** `AuthContext.jsx` imports `createAxiosClient` from `@firefly/sdk/dist/utils/axios-client` — this package is not in `package.json` and is not installed. Remove this import and replace with a real API client when building auth.

2. **`AppContext.jsx` is a dead duplicate.** It exports the same `useAuth` name as `AuthContext.jsx` but is unused. Delete it during cleanup.

3. **`api/client.js` returns a config object, not an API client.** Every `client.auth.*`, `client.entities.*`, and `client.integrations.*` call throughout the codebase will fail at runtime. All data-fetching pages fall back to hardcoded `MOCK_*` arrays.

4. **No Vite proxy is configured.** The client expects `/api/` requests to reach the backend but `vite.config.js` has no proxy setting. Add one when the backend exists.

5. **Exercise code editor is a `<textarea>`.** Monaco Editor is not yet installed. Replace with `@monaco-editor/react` when building code execution features.

6. **Age groups on the home page show 6–9 / 10–13 / 14–17** but the spec standardized on **8–10 / 11–13 / 14+**. Update the home page when implementing the adaptive UI engine.

7. **Unused dependencies** in `package.json`: Stripe, react-leaflet, react-quill, jspdf, html2canvas — these are not used anywhere. Consider removing during cleanup.

## Security considerations

- **COPPA compliance**: Parental consent required for users under 13. Never store unnecessary personal data for minors.
- **Sandboxing**: All user-submitted code must execute in isolated containers with no network access, no filesystem persistence, and strict resource limits.
- **LLM safety**: All AI output must pass through a moderation layer. Never generate full solutions unless in explicit "show solution" mode.
- **Auth**: Use bcrypt for password hashing. JWT access tokens should be short-lived (15 min). Refresh tokens must support rotation.
- **Input validation**: Validate all inputs server-side with Zod/JSON Schema. Never trust client-provided data.
- **Rate limiting**: Apply per-user rate limits on execution (10/min) and LLM (20/min) endpoints.

## PR and commit guidelines

- Commit messages: imperative mood, concise. E.g., `Add JWT auth middleware`, `Wire curriculum page to real API`.
- PR title format: `[area] Description` — e.g., `[server] Add auth routes`, `[client] Replace textarea with Monaco editor`.
- Run `npm run lint` in `code/client/` before committing client changes.
- Run `npm test` (once configured) before committing server changes.
- All CI checks must pass before merging.
