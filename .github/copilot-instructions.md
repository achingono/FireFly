# FireFly Copilot Instructions

Use these instructions for all code generation and edits in this repository.

## Project snapshot

- FireFly is a TypeScript monorepo with:
	- `code/client`: React + Vite + Tailwind SPA
	- `code/server`: Fastify + Prisma + PostgreSQL API
- Primary product features: visual code stepper, mastery tracking (BKT), adaptive theme modes (Fun/Balanced/Pro), OIDC-based auth, AI explain/hint/chat.
- Full stack runs via Docker Compose and is accessible at `https://localhost:9443`.
- Authentication test credentials are defined in `config/oidc/users.json`.

## Non-negotiable rules

- Keep changes minimal and scoped to the request.
- Do not manually edit files in `code/client/src/components/ui/`.
- Treat `code/client/src/pages.config.ts` as auto-generated; only `mainPage` is intended to be editable.
- Use TypeScript only (`.ts` / `.tsx`), functional React components, and React hooks.
- Prefer `@/` imports for client code from `src/`.
- Follow existing style: semicolons, double quotes, clear variable names.
- Prefix intentionally unused variables with `_`.
- Do not add inline code comments unless explicitly requested.

## Client conventions (`code/client`)

- Stack: React 18, `react-router-dom` v6, TanStack Query, Tailwind CSS, shadcn/ui, Monaco Editor.
- Global providers are composed in `src/app.tsx`.
- App shell/navigation is in `src/layout.tsx`.
- Route pages live under `src/pages/` and are registered in `src/pages.config.ts`.
- Theme behavior is centralized in `src/lib/ThemeContext.tsx` and CSS tokens in `src/index.css`.
- Use existing design tokens/utilities (`hsl(var(--...))`, `ff-text-*`, `ff-rounded`) rather than hard-coded styles.
- For forms, follow existing `react-hook-form` + `zod` patterns.
- Use Lucide icons (`lucide-react`) and existing UI primitives before introducing new dependencies.

## Server conventions (`code/server`)

- Stack: Fastify 5, Prisma 7, PostgreSQL, Redis, Zod validation.
- Keep routes under `/api/v1/` and follow existing route modules in `src/routes/`.
- Use envelope responses via `reply.envelope(...)` / `reply.envelopeError(...)`.
- Respect auth decorators from `src/plugins/auth.ts` (`authenticate`, `requireRole`).
- Keep request tracing semantics (`X-Request-Id`) intact.
- Use existing config modules (`src/config/env.ts`, `database.ts`, `redis.ts`) instead of reinitializing clients.

## Data and domain expectations

- Mastery logic uses Bayesian Knowledge Tracing; avoid changing model constants or threshold behavior unless requested.
- Execution pipeline depends on Judge0 + Python tracing semantics; preserve trace shape compatibility.
- AI endpoints (`/ai/explain`, `/ai/hint`, `/ai/chat`) must preserve age-adaptive behavior and hint safety guardrails.

## Security and compliance guardrails

- Preserve COPPA-conscious behavior and avoid introducing unnecessary personal data collection.
- Validate all server inputs with Zod.
- Never trust client input for role/authorization decisions.
- Keep sandboxing assumptions for code execution intact (no privileged execution paths).

## Build and validation workflow

- Client:
	- `npm run lint`
	- `npm run typecheck`
	- `npm run build`
- Server:
	- `npm run build`
	- `npm run lint` (if touching server source)
- Do not fix unrelated failing checks unless explicitly requested.

## Documentation alignment

- When behavior changes, update the relevant docs under `docs/` (`api/`, `guides/`, `architecture/`) in the same PR.
- Keep endpoint and payload docs synchronized with implementation changes.

## Preferred implementation style

- Fix root causes over superficial patches.
- Reuse existing abstractions (contexts, hooks, API client methods, plugins) before creating new ones.
- Avoid introducing new frameworks or broad architectural shifts unless explicitly asked.
