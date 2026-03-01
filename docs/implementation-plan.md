# FireFly — Implementation Plan

> Work plan to take FireFly from its current state (UI shell with mock data) to a functional MVP as defined in [SPEC.md](SPEC.md).

**Created**: 2026-03-01  
**Tracks against**: [SPEC.md](SPEC.md) §15 — Implementation Roadmap

---

## Current State Assessment

### What Exists

| Area | Status |
|------|--------|
| **Client shell** | React + Vite + JSX SPA with routing, layout, and nav |
| **UI component library** | 50+ shadcn/ui primitives fully configured |
| **Page UIs** | Home (landing), Auth (login/register forms), Curriculum (concept browser), Exercise (coding view), Dashboard (student), Teacher Dashboard, Visualizer — all built with hardcoded mock data |
| **Visualizer panes** | Code, Stack, Heap, Output panes + stepper controls + AI explain panel — display components fully implemented |
| **Mock trace** | 10-frame bubble sort trace demonstrating the visualizer |

### What's Missing

| Area | Gap |
|------|-----|
| **Backend** | `code/server/` is empty — no API, no database, no auth |
| **API client** | Stub object; no HTTP methods; imports missing `@firefly/sdk` |
| **Authentication** | UI forms exist but submit to nothing; JWT flow not implemented |
| **Database** | No schema, no migrations, no models |
| **Code execution** | No sandbox integration (Judge0/OneCompiler); "Run" is a sleep timer |
| **Trace generation** | No real tracer; only hardcoded mock |
| **AI integration** | All LLM calls reference a non-existent SDK method |
| **Code editor** | Plain `<textarea>` instead of Monaco |
| **TypeScript** | Spec calls for TS; all client files are JSX |
| **DevOps** | No Docker Compose, Dockerfile, `.env.example`, or Vite API proxy |
| **Adaptive themes** | Home page mentions 3 age groups but no theme context/switching exists |
| **Mastery engine** | No scoring, no progression logic, no concept prerequisites |
| **Real data flow** | Every page falls back to hardcoded arrays |

---

## Implementation Phases

### Phase 0 — Foundation & Infrastructure (Weeks 1–2)

Set up the project skeleton so all subsequent work has a functioning local dev environment.

#### 0.1 — Dev Infrastructure

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 0.1.1 | Create `.env.example` | Document all env vars (DB, Redis, Judge0, LLM, JWT, Vite) | File exists at repo root with comments |
| 0.1.2 | Create `docker-compose.yml` | Services: postgres, redis, judge0 (CE), api, client | `docker compose up` starts full stack |
| 0.1.3 | Add API Dockerfile | Node.js + Fastify multi-stage build | `docker build` succeeds |
| 0.1.4 | Configure Vite API proxy | Proxy `/api` → `http://localhost:3000` in `vite.config.js` | Client requests reach backend in dev |
| 0.1.5 | Add `.dockerignore` and update `.gitignore` | Ignore node_modules, dist, .env, docker volumes | Clean repo, clean images |

#### 0.2 — Backend Scaffold

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 0.2.1 | Init `code/server/` | `package.json`, `tsconfig.json`, Fastify entry point, ESLint, nodemon | `npm run dev` starts Fastify on port 3000 |
| 0.2.2 | Response envelope plugin | Fastify plugin wrapping all responses in `{status, code, requestId, data, meta}` | Every route returns envelope format |
| 0.2.3 | Error handler plugin | Catches errors → `{status:"error", code, requestId, error:{type, message, details}}` | Validation errors, 404s, 500s all formatted |
| 0.2.4 | Request tracing | Accept `X-Request-Id`, generate if missing, echo in response | Header round-trips on every call |
| 0.2.5 | Health check route | `GET /api/v1/health` → `{status:"ok"}` | Responds 200 |
| 0.2.6 | CORS configuration | Allow client origin in dev | Cross-origin requests work |

#### 0.3 — Database Setup

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 0.3.1 | Install Prisma + PostgreSQL driver | Configure `prisma/schema.prisma` with provider `postgresql` | `npx prisma init` succeeds |
| 0.3.2 | Define core schema | User, Concept, Lesson, Exercise, Trace, Session, MasteryRecord (per SPEC §13) | Schema validates |
| 0.3.3 | Create initial migration | `npx prisma migrate dev --name init` | Tables created in Postgres |
| 0.3.4 | Seed script | `POST /api/v1/admin/seed` — 5 users (student/teacher/admin), 8 concepts, 5 lessons, 10 exercises | Seed populates DB; re-runnable |
| 0.3.5 | Redis connection | ioredis client singleton for session/cache use | Connection verified on startup |

#### 0.4 — Client TypeScript Migration

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 0.4.1 | Rename `.jsx` → `.tsx`, `.js` → `.ts` | All client source files | Build succeeds with `tsc --noEmit` |
| 0.4.2 | Add base types | `types/` directory: User, Concept, Lesson, Exercise, TraceFrame, MasteryRecord, API envelope | Shared types imported across app |
| 0.4.3 | Fix type errors | Address strictest-possible TS errors from migration | Zero TS errors |

---

### Phase 1 — Auth & API Client (Week 3)

Replace the stub API client and connect the auth UI to real endpoints.

#### 1.1 — Backend Auth

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 1.1.1 | `POST /api/v1/auth/register` | Validate `{email, password, role, age}`, hash password (bcrypt), create User, return JWT + user | New user in DB; JWT valid |
| 1.1.2 | `POST /api/v1/auth/login` | Validate credentials, return `{token, refreshToken, user}` | Correct password → 200; wrong → 401 |
| 1.1.3 | `POST /api/v1/auth/refresh` | Accept refresh token → new access + refresh pair | Token rotation works |
| 1.1.4 | Auth middleware | Fastify preHandler: verify JWT, attach `request.user` | Protected routes reject invalid tokens |
| 1.1.5 | Role-based access | `requireRole('teacher')` guard decorator | Unauthorized role → 403 |

#### 1.2 — Client API Client

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 1.2.1 | Rewrite `api/client.ts` | Axios/fetch wrapper: base URL from env, JWT injection, request-id header, error handling | All API calls use typed methods |
| 1.2.2 | Auth methods | `register()`, `login()`, `refresh()`, `logout()`, `me()` | Return typed responses |
| 1.2.3 | Remove `@firefly/sdk` import | Replace all references in AuthContext with new client | No broken imports |
| 1.2.4 | Token storage | Store JWT in memory + refresh token in httpOnly cookie or localStorage | Token persists across reloads |

#### 1.3 — Connect Auth UI

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 1.3.1 | Wire `auth.tsx` register form | Call `client.auth.register()`, store token, redirect to dashboard | End-to-end registration works |
| 1.3.2 | Wire `auth.tsx` login form | Call `client.auth.login()`, redirect | Login works with seeded users |
| 1.3.3 | Fix `AuthContext` | Remove `@firefly/sdk` dependency, use new client, manage auth state | `useAuth()` returns real user |
| 1.3.4 | Protected route guards | Redirect unauthenticated users to `/auth` | Can't access `/dashboard` without login |
| 1.3.5 | Wire layout user display | Nav shows real user name, XP, streak from `me()` | Layout reflects logged-in user |

---

### Phase 2 — Curriculum & Exercises (Weeks 4–5)

Wire the curriculum browser and exercise pages to the real backend.

#### 2.1 — Backend Curriculum Routes

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 2.1.1 | `GET /api/v1/concepts` | List with filtering (difficulty, tags), cursor pagination | Returns seeded concepts |
| 2.1.2 | `GET /api/v1/concepts/:id` | Detail with prerequisites and recommended exercises | Returns full concept with relations |
| 2.1.3 | `GET /api/v1/lessons/:id` | Lesson content, examples, linked exercises | Markdown content + exercise list |
| 2.1.4 | `GET /api/v1/exercises/:id` | Exercise metadata, test cases, expected trace patterns | Full exercise payload |
| 2.1.5 | `POST /api/v1/exercises/:id/submit` | Accept `{code, language}`, enqueue execution job, return `{jobId}` | Job ID returned immediately |

#### 2.2 — Connect Client Pages

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 2.2.1 | Wire `curriculum.tsx` | Replace `MOCK_CONCEPTS` with `useQuery` → `GET /concepts` | Real data loads; search/filter works |
| 2.2.2 | Wire `exercise.tsx` | Load exercise from `exerciseId` URL param via `GET /exercises/:id` | Exercise prompt, test cases from DB |
| 2.2.3 | Concept detail page | New page or modal: concept description, prerequisites, "Start Lesson" button | Navigate from curriculum → lesson → exercise |
| 2.2.4 | Curriculum content authoring | Populate DB with 5 complete lessons (variables, conditionals, loops, functions, lists), each with 2–3 exercises | Students can progress through real content |

---

### Phase 3 — Code Execution & Tracing (Weeks 5–7)

This is the critical path — connect real code execution and build the trace generator.

#### 3.1 — Judge0 Integration

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 3.1.1 | Judge0 CE in Docker Compose | Add judge0-server, judge0-workers, judge0-db services | `POST /submissions` to Judge0 returns results |
| 3.1.2 | Execution service | Backend service: submit code to Judge0, poll/webhook for result, store stdout/stderr | `POST /execution/run` returns `{jobId}` |
| 3.1.3 | `GET /execution/jobs/:jobId` | Return job status (queued/running/completed/error) and result | Client can poll for completion |
| 3.1.4 | Exercise submission flow | `POST /exercises/:id/submit` → run against test cases → return pass/fail per test | Exercise grading works end-to-end |
| 3.1.5 | Execution limits | Timeout (5s), memory (256MB), no network, per-user rate limit | Infinite loops don't crash the system |

#### 3.2 — Trace Generator

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 3.2.1 | Python tracer | Use `sys.settrace` or `bdb` to capture line events, stack frames, locals, heap objects | Produces trace matching SPEC §12 schema |
| 3.2.2 | JavaScript tracer | Use `Debugger` API or AST instrumentation to capture equivalent trace | JS programs produce valid traces |
| 3.2.3 | Trace endpoint | `GET /execution/jobs/:jobId/trace` → returns canonical trace JSON | Trace conforms to schema version 1.0 |
| 3.2.4 | Trace transformer | `POST /visualizer/transform` → optimized frames (diffed, grouped) | Reduced payload for large traces |
| 3.2.5 | WebSocket streaming | `WS /execution/jobs/:jobId/stream` → emit frames as they're generated | Stepper can play in real-time |

#### 3.3 — Monaco Editor Integration

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 3.3.1 | Install `@monaco-editor/react` | Add to client dependencies | Import works |
| 3.3.2 | Replace `<textarea>` in exercise page | Monaco with Python/JS syntax highlighting, autocomplete, age-themed config | Proper code editing experience |
| 3.3.3 | Replace `<textarea>` in visualizer page | Monaco for the code input area | Syntax highlighting in visualizer |
| 3.3.4 | Read-only mode for stepper code pane | Keep existing code-pane component for trace playback (read-only highlighted display) | Stepper still works as before |

#### 3.4 — Connect Visualizer to Real Execution

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 3.4.1 | Wire "Run" button | Submit code → execution service → poll for result → display output | Real stdout appears in output pane |
| 3.4.2 | Wire "Visualize" button | Submit with `captureTrace: true` → fetch trace → feed to stepper | Real trace drives the stepper |
| 3.4.3 | Keep mock trace as fallback | If execution fails, offer demo with mock trace | Visualizer never breaks completely |
| 3.4.4 | Language switching | Python ↔ JavaScript: change Monaco language, use correct tracer | Both languages produce valid traces |

---

### Phase 4 — Adaptive UI Engine (Week 8)

Implement the age-profile theme system defined in SPEC §8.

#### 4.1 — Theme Infrastructure

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 4.1.1 | Create `ThemeContext` | React Context: `{mode: 'fun'|'balanced'|'pro', setMode, preferences}` | `useTheme()` available app-wide |
| 4.1.2 | Tailwind theme variables | CSS custom properties for colors, fonts, spacing per mode | `data-theme="fun"` on root changes palette |
| 4.1.3 | Persist preferences | localStorage + cloud sync via `PATCH /users/:id` | Theme survives reload and syncs across devices |
| 4.1.4 | Auto-set from age | On registration/login, set default mode from user age | 8yo gets Fun, 14yo gets Pro |

#### 4.2 — Theme Switcher UI

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 4.2.1 | Header theme toggle | Global button in nav bar (sun/moon + robot icon) | One-click mode switch |
| 4.2.2 | Profile settings page | Age group selector, mascot toggle, confetti toggle, color palette picker, sound/animation sliders | All customizations saved |
| 4.2.3 | Parent PIN lock | Under-13 profile changes require 4-digit PIN | Kids can't change locked settings |

#### 4.3 — Themed Component Variants

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 4.3.1 | Visualizer skins | Fun: cartoon arrows, colored bubbles. Pro: DevTools style, addresses, hex toggle | Visual difference is obvious |
| 4.3.2 | Editor themes | Fun: "Light Bright". Pro: "Dark Modern" (VS Code Dark+) | Monaco theme changes with mode |
| 4.3.3 | Celebration styles | Fun: confetti + mascot. Balanced: badges. Pro: subtle checkmark | Mastery events render correctly per mode |
| 4.3.4 | Navigation style | Fun: world map. Pro: clean tree | Dashboard adapts |
| 4.3.5 | CTA buttons | Fun: "Let's Go!" / Pro: "Execute" | Button text/style changes per mode |

---

### Phase 5 — Mastery & Progression (Weeks 9–10)

Implement the adaptive learning engine from SPEC §10.

#### 5.1 — Backend Mastery Service

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 5.1.1 | BKT scoring algorithm | Bayesian Knowledge Tracing: inputs = test pass rate, hint usage, time, trace analysis → mastery score 0–1 | Score updates correctly per attempt |
| 5.1.2 | `POST /progress/:userId/update` | Accept attempt result, compute new mastery, store MasteryRecord | Score persists in DB |
| 5.1.3 | `GET /progress/:userId` | Return mastery map (all concepts with scores), recent attempts | Full progress snapshot |
| 5.1.4 | Progression logic | Check prerequisites + mastery ≥ 0.80 + transfer check → unlock next concept | Locked concepts show as locked |
| 5.1.5 | Remediation selection | If mastery < threshold after N attempts, recommend easier exercises or visual walkthroughs | Remediation items returned in progress response |

#### 5.2 — Connect Client Dashboard

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 5.2.1 | Wire `dashboard.tsx` | Replace `MOCK_PROGRESS` with `useQuery` → `GET /progress/:userId` | Real mastery data displayed |
| 5.2.2 | Wire mastery map component | Real concept statuses (mastered/in_progress/locked/not_started) | Map reflects actual progress |
| 5.2.3 | Wire recent activity | Fetch real session history | Activity feed shows real events |
| 5.2.4 | XP and streak calculation | Backend computes from session history; displayed in nav + dashboard | Real XP/streak values |
| 5.2.5 | "Continue where you left off" | Query last incomplete exercise | Card links to real exercise |

#### 5.3 — Exercise Submission → Mastery Loop

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 5.3.1 | Post-submission mastery update | After exercise graded, call mastery update endpoint | Score recalculated |
| 5.3.2 | Concept unlock notification | If mastery crosses 0.80, show celebration + unlock message | User sees new content available |
| 5.3.3 | Hint tracking | Count hints used per exercise, feed into BKT | Hint count stored in session |
| 5.3.4 | Transfer check | After mastery threshold, present one "transfer" exercise in different context | Transfer pass required for full unlock |

---

### Phase 6 — AI Integration (Weeks 11–12)

Wire the LLM proxy and connect AI features across the platform.

#### 6.1 — Backend LLM Proxy

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 6.1.1 | LLM service | Configurable provider (OpenAI/Anthropic/local), API key from env, rate limiting | Service resolves to configured provider |
| 6.1.2 | Prompt templates | Templates with `{userAge}`, `{mode}`, `{conceptTag}`, `{code}`, `{traceStep}` placeholders | Templates produce age-appropriate output |
| 6.1.3 | `POST /visualizer/explain` | Accept `{traceStep, ageProfile, tone}`, call LLM, return explanation | Age-appropriate explanation returned |
| 6.1.4 | Moderation layer | Filter all LLM output for age-appropriateness; block full solutions unless "show solution" mode | Unsafe content blocked |
| 6.1.5 | Response caching | Cache common explanations in Redis (trace pattern hash → response) | Repeated requests served from cache |

#### 6.2 — Connect Client AI Features

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 6.2.1 | Wire "Explain this step" | Stepper button → `POST /visualizer/explain` → display in AI panel | Real AI explanation appears |
| 6.2.2 | Wire exercise hints | Hint button → LLM generates progressive hints (not full solution) | Hints escalate in specificity |
| 6.2.3 | Wire teacher AI insights | Teacher dashboard button → LLM analyzes class mastery data | Summary of common struggles |
| 6.2.4 | AI tutor sidebar | New component: chat interface in exercise page, context-aware (code + trace + lesson) | Multi-turn conversation works |

---

### Phase 7 — Teacher & Parent Dashboard (Week 13)

#### 7.1 — Backend Teacher Routes

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 7.1.1 | `GET /admin/analytics` | Aggregated metrics: mastery gains, common errors, time-to-mastery per concept | Dashboard data returned |
| 7.1.2 | Student list endpoint | Teacher sees their students' progress, sorted by "needs attention" | Correct role-scoped data |
| 7.1.3 | Class mastery chart data | Per-concept mastery distribution across class | Bar chart data matches DB |

#### 7.2 — Connect Teacher Dashboard

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 7.2.1 | Wire `teacher.tsx` | Replace `MOCK_STUDENTS` with real data | Teacher sees real student list |
| 7.2.2 | Wire analytics tab | Replace "coming soon" with real charts | Charts render real data |
| 7.2.3 | Student detail drill-down | Click student → see their mastery map, recent sessions, step traces | Full student view works |

#### 7.3 — Parent Dashboard

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 7.3.1 | Parent role and linking | Parent user linked to child user(s) | Parent sees only their children |
| 7.3.2 | Parent dashboard page | Child progress, theme controls, consent management | Parent can manage child settings |
| 7.3.3 | COPPA consent flow | Parental email verification for under-13 accounts | Can't complete under-13 registration without consent |

---

### Phase 8 — Polish & Production Readiness (Weeks 14–16)

#### 8.1 — Memory Animation Prototype

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 8.1.1 | Fun Mode: "Memory City" | PixiJS scene: RAM grid, variable characters, pointer bridges (3 concepts: variables, lists, functions) | Animation driven by real trace data |
| 8.1.2 | Pro Mode: "Memory Lab" | Canvas/WebGL: clean memory grid, labeled boxes, arrows, optional hex | Realistic visualization works |
| 8.1.3 | Toggle button | "Switch to Memory City / Memory Lab" always visible | User can switch views |

#### 8.2 — Accessibility & Performance

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 8.2.1 | Accessibility audit | Axe-core scan, keyboard navigation, screen-reader labels, color contrast | WCAG 2.1 AA compliance |
| 8.2.2 | Long trace optimization | Sample/group steps for traces > 500 frames | No UI lag on large traces |
| 8.2.3 | Lazy-load heavy components | Code-split Monaco, PixiJS, Three.js | Initial bundle < 500KB |
| 8.2.4 | Mobile responsiveness | Test and fix all pages on 360px–768px viewports | Usable on tablets and phones |

#### 8.3 — Testing

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 8.3.1 | Backend API tests | Vitest: all routes, auth flows, mastery calculations, trace validation | ≥ 80% coverage on routes/services |
| 8.3.2 | Client component tests | Vitest + Testing Library: visualizer panes, stepper, auth forms | Key components have snapshot + interaction tests |
| 8.3.3 | E2E smoke tests | Playwright: register → login → browse curriculum → open exercise → run code → view trace → check mastery update | Happy path passes |
| 8.3.4 | Trace fidelity tests | Compare generated traces against known Python Tutor outputs for 10 programs | 100% match on structure |

#### 8.4 — DevOps & Security

| # | Task | Details | Acceptance Criteria |
|---|------|---------|-------------------|
| 8.4.1 | Production Docker Compose | Separate `docker-compose.prod.yml` with proper resource limits | Production stack starts cleanly |
| 8.4.2 | CI pipeline | GitHub Actions: lint, typecheck, test, build on PR | All checks pass on green |
| 8.4.3 | Rate limiting | Per-user rate limits on execution (10/min) and LLM (20/min) endpoints | 429 returned on excess |
| 8.4.4 | Input validation | Zod schemas on all Fastify routes | Invalid payloads → 400 with detailed errors |
| 8.4.5 | Security headers | Helmet, CORS whitelist, CSP, HSTS | Security headers on all responses |

---

## Task Summary

| Phase | Weeks | Tasks | Focus |
|-------|-------|-------|-------|
| **0 — Foundation** | 1–2 | 18 | Docker, backend scaffold, DB schema, TS migration |
| **1 — Auth** | 3 | 13 | JWT auth, API client rewrite, connect auth UI |
| **2 — Curriculum** | 4–5 | 9 | Concept/lesson/exercise CRUD, wire curriculum pages, author content |
| **3 — Execution** | 5–7 | 16 | Judge0, trace generators (Python + JS), Monaco editor, wire visualizer |
| **4 — Adaptive UI** | 8 | 12 | Theme context, switcher, component variants (Fun/Balanced/Pro) |
| **5 — Mastery** | 9–10 | 12 | BKT scoring, progression logic, wire dashboard, submission loop |
| **6 — AI** | 11–12 | 9 | LLM proxy, explain step, hints, teacher insights, tutor sidebar |
| **7 — Dashboards** | 13 | 9 | Teacher analytics, parent dashboard, COPPA consent |
| **8 — Polish** | 14–16 | 14 | Memory animation, accessibility, testing, CI/CD, security |
| | **Total** | **112 tasks** | |

---

## Dependencies & Critical Path

```
Phase 0 (Foundation)
  └─► Phase 1 (Auth) ──────────────────────────────────────────►─┐
       └─► Phase 2 (Curriculum) ──┐                               │
            └─► Phase 3 (Execution & Tracing) ◄── CRITICAL PATH   │
                 ├─► Phase 4 (Adaptive UI) ── can start week 7    │
                 ├─► Phase 5 (Mastery) ── requires 2 + 3          │
                 │    └─► Phase 6 (AI) ── requires 3 + 5          │
                 │         └─► Phase 7 (Dashboards) ── requires all│
                 └─► Phase 8 (Polish) ── requires all ◄───────────┘
```

**Critical path**: Phase 0 → 1 → 2 → 3 (Execution & Tracing). The visual code stepper connected to real execution is the product's primary feature and the longest dependency chain. Everything else branches from it.

**Parallelization opportunities**:
- Phase 4 (Adaptive UI) can begin once Phase 0 is done — it's mostly a frontend-only effort and doesn't depend on execution.
- Phase 8.3 (Testing) can start writing test scaffolds during Phase 1.
- Content authoring (task 2.2.4) can happen in parallel with any backend work.

---

## Definition of Done (MVP)

The MVP is complete when a user can:

1. **Register and log in** with email/password and role/age selection.
2. **Browse concepts** in the curriculum, filtered by difficulty.
3. **Open a lesson** and read its content.
4. **Complete an exercise** by writing code in a Monaco editor.
5. **Run code** in a sandboxed environment and see stdout/stderr.
6. **Step through execution visually** with real trace data driving the Code / Stack / Heap / Output panes.
7. **Click "Explain this step"** and receive an age-appropriate AI explanation.
8. **See mastery progress** update after submissions.
9. **Unlock the next concept** after reaching ≥ 80% mastery.
10. **Switch UI theme** between Fun / Balanced / Pro modes.
11. **Teacher** can view student progress and common misconceptions.

All of the above with Python programs. JavaScript support is a Phase 3 stretch goal.
