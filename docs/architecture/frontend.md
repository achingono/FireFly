# Frontend Architecture

The FireFly client is a React 18 single-page application built with TypeScript, Vite, and Tailwind CSS. It provides an adaptive, age-appropriate UI for coding education with a visual code stepper, curriculum browser, exercise editor, and student dashboard.

## Directory Structure

```
code/client/
├── public/                    # Static assets served by Vite/Nginx
├── src/
│   ├── app.tsx                # Root component: providers + router
│   ├── layout.tsx             # App shell: nav bar, user display, mobile menu
│   ├── main.tsx               # React DOM render entry point
│   ├── index.css              # Tailwind base + theme CSS custom properties
│   ├── pages.config.ts        # Route definitions (PAGES map)
│   ├── api/
│   │   └── client.ts          # HTTP API client with all endpoint methods
│   ├── components/
│   │   ├── ui/                # 47 shadcn/ui primitives (DO NOT manually edit)
│   │   ├── visualizer/        # Code stepper pane components
│   │   │   ├── code-pane.tsx
│   │   │   ├── stack-pane.tsx
│   │   │   ├── heap-pane.tsx
│   │   │   ├── output-pane.tsx
│   │   │   ├── stepper-controls.tsx
│   │   │   ├── ai-explain-panel.tsx
│   │   │   └── mock-trace.tsx
│   │   └── dashboard/         # Dashboard widgets
│   │       ├── mastery-map.tsx
│   │       ├── progress-ring.tsx
│   │       └── recent-activity.tsx
│   ├── hooks/                 # Custom React hooks
│   ├── lib/
│   │   ├── AuthContext.tsx     # Authentication context + provider
│   │   ├── ThemeContext.tsx    # Theme/age-mode context + provider
│   │   └── utils.ts           # Utility functions (cn, etc.)
│   ├── pages/
│   │   ├── home.tsx           # Landing page
│   │   ├── auth.tsx           # Auth callback handler
│   │   ├── onboarding.tsx     # Post-login profile setup
│   │   ├── visualizer.tsx     # Visual code stepper (core feature)
│   │   ├── curriculum.tsx     # Concept/lesson browser
│   │   ├── exercise.tsx       # Exercise list + editor + execution
│   │   ├── dashboard.tsx      # Student progress dashboard
│   │   └── teacher-dashboard.tsx
│   ├── types/
│   │   ├── index.ts           # Domain models (User, Concept, Lesson, etc.)
│   │   ├── api.ts             # API envelope types, request/response shapes
│   │   └── trace.ts           # Trace, TraceFrame, StackFrame, HeapObject
│   └── assets/                # Images, fonts, static assets
├── vite.config.js             # Vite config with @/ alias and API proxy
├── tailwind.config.js         # Tailwind + shadcn/ui theme tokens
├── tsconfig.json
├── package.json
├── Dockerfile                 # Multi-stage build (deps → build → Nginx)
└── nginx.conf                 # Production Nginx config with API proxy
```

## Application Bootstrap (`app.tsx`)

The component tree wraps providers in this order:

```
<AuthProvider>                 // Authentication state
  <ThemeProvider>              // Age-mode theming
    <QueryClientProvider>      // TanStack Query cache
      <Router>                 // React Router v6
        <Routes>
          <Layout>             // Nav bar, app shell
            <Page />           // Route-matched page component
          </Layout>
        </Routes>
      </Router>
    </QueryClientProvider>
  </ThemeProvider>
</AuthProvider>
```

## Routing (`pages.config.ts`)

Routes are defined as a flat `PAGES` map:

```typescript
export const PAGES = {
  Home:             { path: "/",                 component: Home },
  Auth:             { path: "/auth/callback",    component: Auth },
  Onboarding:       { path: "/onboarding",       component: Onboarding },
  Visualizer:       { path: "/visualizer",       component: Visualizer },
  Curriculum:       { path: "/curriculum",        component: Curriculum },
  Exercise:         { path: "/exercise",          component: Exercise },
  Dashboard:        { path: "/dashboard",         component: Dashboard },
  TeacherDashboard: { path: "/teacher-dashboard", component: TeacherDashboard },
};
```

**Protected routes**: Only `Home`, `Auth`, and `Onboarding` are public. All other pages require:
1. Valid authentication (JWT token)
2. Completed onboarding (`user.onboarded === true`)

Unauthenticated users are redirected to `Home`. Authenticated but not onboarded users are redirected to `Onboarding`.

## Contexts

### AuthContext (`lib/AuthContext.tsx`)

Manages authentication lifecycle:

- **On mount**: Checks URL for `token` query parameter (set by OIDC callback redirect). If present, stores in localStorage and cleans the URL.
- **Token management**: Stores JWT in `localStorage`. Attaches to API client for authenticated requests.
- **User loading**: Calls `GET /api/v1/auth/me` on mount to fetch the current user profile.
- **Provides**: `user`, `loading`, `login()` (redirects to OIDC), `logout()`, `refresh()`, `setUser()`

### ThemeContext (`lib/ThemeContext.tsx`)

Manages adaptive theming across three modes:

- **Mode resolution** (priority order): localStorage override → `user.ageProfile` → `"balanced"` default
- **DOM effects**: Applies `.theme-{mode}` class to `<html>`. Pro mode also adds `.dark` class.
- **Persistence**: Mode saved to localStorage on change.
- **Provides**: `mode`, `setMode()`, `isDark`

## API Client (`api/client.ts`)

A centralized HTTP client with methods for every API endpoint:

```typescript
const api = {
  auth: {
    login(),              // Redirect to OIDC
    me(),                 // GET /auth/me
    refresh(),            // POST /auth/refresh
    logout(),             // POST /auth/logout
    onboard(data),        // POST /auth/onboard
    register(data),       // POST /auth/register (alias)
    redirectToLogin(),    // Window navigation to login URL
  },
  entities: {
    // Generic CRUD proxy — api.entities.concepts.list(), .get(id), .create(data)
    [resource]: { list(params?), get(id), create(data) }
  },
  ai: {
    explain(data),        // POST /ai/explain
    hint(data),           // POST /ai/hint
    chat(data),           // POST /ai/chat
  },
  execution: {
    run(data),            // POST /execution/run
    status(jobId),        // GET /execution/jobs/:id
    trace(jobId),         // GET /execution/jobs/:id/trace
  },
  progress: {
    masteryMap(userId),   // GET /progress/:userId
    submit(userId, data), // POST /progress/:userId/update
  },
};
```

All methods automatically:
- Prepend the API base URL (`VITE_API_URL` or `/api/v1`)
- Attach the JWT token as `Authorization: Bearer` header
- Return unwrapped `data` from the API envelope

## Pages

### Visualizer (`pages/visualizer.tsx` — 527 lines)

The core feature page. A 4-pane grid showing code execution step-by-step:

| Pane | Component | Content |
|------|-----------|---------|
| Code | `code-pane.tsx` | Monaco Editor with line highlighting |
| Stack | `stack-pane.tsx` | Call stack frames with local variables |
| Heap | `heap-pane.tsx` | Heap objects (lists, dicts) with type coloring |
| Output | `output-pane.tsx` | stdout/stderr accumulating per step |

**Features**:
- Play/pause auto-stepping with configurable speed
- Step forward/backward/jump to any frame
- Click on progress bar to jump to specific step
- Event type badges (line, call, return, exception)
- AI explain button — sends current frame context to LLM
- Loads traces from: URL query params (`exerciseId`, `jobId`), or interactive code entry
- Transforms backend trace format to UI format (parseRepr for Python values, heap synthesis from list/dict locals)

### Exercise (`pages/exercise.tsx` — 555 lines)

Dual-mode page: exercise list + exercise detail with code editor:

**List View**:
- Grid of exercise cards grouped by concept
- Filter by concept via dropdown
- Difficulty badges (beginner/intermediate/advanced)
- Language indicators

**Detail View**:
- Monaco Editor with language-appropriate syntax highlighting
- Run button → submits to Judge0 → polls for completion
- Test case display (expected vs actual output)
- AI hint integration (sends code + exercise context)
- Mastery feedback with animated progress bar
- Concept unlock notifications when threshold reached

### Dashboard (`pages/dashboard.tsx` — 151 lines)

Student progress overview:

- **Stats grid**: XP points, streak, mastered concepts count, overall progress percentage
- **MasteryMap**: Visual grid of all concepts with mastery scores and status indicators
- **ProgressRing**: Animated SVG ring showing overall completion
- **RecentActivity**: Latest exercise attempts and mastery updates
- **Quick actions**: Cards linking to in-progress concepts

### Other Pages

- **Home** — Landing page with age group cards, feature highlights
- **Auth** — Callback handler that extracts token from URL and redirects
- **Onboarding** — Post-login form to set display name, age, role, age profile
- **Curriculum** — Browse concepts and lessons with descriptions and ordering
- **TeacherDashboard** — Teacher view with class overview (placeholder)

## Component Architecture

### Visualizer Components (`components/visualizer/`)

| Component | Lines | Purpose |
|-----------|-------|---------|
| `code-pane.tsx` | 83 | Monaco editor with `deltaDecorations` for line highlighting |
| `stack-pane.tsx` | 62 | Animated stack frames with Framer Motion, active frame indicator |
| `heap-pane.tsx` | 77 | Type-colored heap objects (list items, dict entries) |
| `output-pane.tsx` | 41 | stdout/stderr display with cumulative step counter |
| `stepper-controls.tsx` | 131 | Playback controls, progress bar, event badges, speed slider |
| `ai-explain-panel.tsx` | 59 | Slide-up panel for AI explanations with age profile badge |
| `mock-trace.tsx` | — | Legacy 10-frame bubble sort trace (kept for reference) |

### Dashboard Components (`components/dashboard/`)

| Component | Purpose |
|-----------|---------|
| `mastery-map.tsx` | Grid of concept cards with mastery scores and color coding |
| `progress-ring.tsx` | Animated SVG circular progress indicator |
| `recent-activity.tsx` | List of recent learning events |

### UI Components (`components/ui/`)

47 shadcn/ui primitives (New York style). These are auto-generated — do not manually edit. Add new components via:

```bash
npx shadcn@latest add <component-name>
```

## Type System (`types/`)

### Domain Models (`types/index.ts`)

```typescript
interface User {
  id: string;
  email: string;
  displayName?: string;
  role: "student" | "teacher" | "parent" | "admin";
  age?: number;
  ageProfile: "fun" | "balanced" | "pro";
  onboarded: boolean;
}

interface Concept {
  id: string;
  name: string;
  slug: string;
  description: string;
  order: number;
  prerequisites: string[];
}

interface Exercise {
  id: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  language: string;
  starterCode: string;
  solutionCode?: string;
  testCases: TestCase[];
  conceptId: string;
}
```

### Trace Types (`types/trace.ts`)

```typescript
interface Trace {
  frames: TraceFrame[];
  metadata: TraceMetadata;
}

interface TraceFrame {
  step: number;
  line: number;
  event: "line" | "call" | "return" | "exception";
  funcName: string;
  locals: Record<string, unknown>;
  stack: StackFrame[];
  stdout: string;
  stderr: string;
}
```

### API Types (`types/api.ts`)

```typescript
interface ApiEnvelope<T> {
  status: "success";
  code: number;
  requestId: string;
  data: T;
  meta: { schemaVersion: string };
}

interface ApiError {
  status: "error";
  code: number;
  requestId: string;
  error: { type: string; message: string; details?: unknown[] };
}
```

## Build & Deployment

### Development
```bash
npm run dev  # Vite dev server on :5173, proxies /api to :3000
```

### Production (Docker)
The client uses a 3-stage Dockerfile:
1. **deps** — Install node_modules
2. **builder** — `npm run build` produces static files in `dist/`
3. **runner** — Nginx Alpine serves `dist/`, proxies `/api/` to server

Nginx configuration (`nginx.conf`):
- `/api/` → proxy to `http://server:3000`
- All other routes → `index.html` (SPA fallback)
- Static assets get cache headers

## Related Documentation

- [Architecture Overview](./overview.md)
- [Backend Architecture](./backend.md)
- [Theming Guide](../guides/theming.md)
- [Development Guide](../guides/development.md)
