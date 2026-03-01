# FireFly

An AI-powered, mastery-based coding education platform for kids (ages 8+) that **visually steps through code execution**, adapts to the learner's age, and teaches programming concepts through demonstrated understanding.

---

## What Is FireFly?

FireFly is a web platform where children learn to code by writing real programs, watching them execute step-by-step, and building genuine understanding before moving on. It combines:

- **A visual code stepper** (the core feature) — line-by-line execution with animated stack, heap, variable, and I/O panels inspired by [Python Tutor](https://pythontutor.com)
- **Mastery-based progression** — concepts unlock only after the learner demonstrates ≥ 80% understanding (Bayesian Knowledge Tracing)
- **An AI tutor** — context-aware hints and explanations grounded in the actual execution trace, adapted to the learner's age
- **Age-adaptive UI** — three modes (Fun / Balanced / Pro) that adjust visuals, tone, and complexity

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite + TypeScript)         :80 / :5173   │
│  ├── Monaco Code Editor                                     │
│  ├── Visual Stepper (Code / Stack / Heap / Output panes)    │
│  ├── AI Tutor Panel                                         │
│  └── Adaptive UI Engine (Fun / Balanced / Pro themes)       │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────────┐
│  Backend API (Node.js + Fastify + TypeScript)       :3000   │
│  ├── Auth (OIDC login + JWT access/refresh tokens)          │
│  ├── Curriculum CRUD (Concepts, Lessons, Exercises)         │
│  ├── Progress & Mastery (Bayesian Knowledge Tracing)        │
│  ├── Execution orchestrator → Judge0                        │
│  ├── Python tracer (sys.settrace) → JSON trace frames       │
│  └── LLM proxy (OpenAI-compatible, age-adapted prompts)     │
└──────┬──────────────┬──────────────┬──────────┬─────────────┘
       │              │              │          │
┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼──────┐ ┌▼────────────┐
│ PostgreSQL  │ │   Redis   │ │  Judge0 +  │ │ OIDC        │
│ :5432       │ │   :6379   │ │  Workers   │ │ Provider    │
│ (Prisma ORM)│ │ (PKCE,    │ │  :2358     │ │ :9000       │
│             │ │  cache)   │ │ (sandboxed │ │ (simple-    │
│             │ │           │ │  execution)│ │  oidc)      │
└─────────────┘ └───────────┘ └────────────┘ └─────────────┘
```

All 7 services run via Docker Compose. See [Deployment Guide](docs/guides/deployment.md) for details.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui (New York), Framer Motion |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| State | React Context (auth, theme), TanStack Query (server state) |
| Routing | react-router-dom v6 |
| Forms | react-hook-form + Zod validation |
| Backend | Node.js, Fastify, TypeScript |
| ORM | Prisma with PostgreSQL (`@prisma/adapter-pg`) |
| Auth | OIDC via `ghcr.io/plainscope/simple-oidc-provider` + JWT (access 15min, refresh 7d) |
| Code Execution | Self-hosted Judge0 with Python `sys.settrace()` tracer |
| AI / LLM | OpenAI-compatible API via LM Studio (localhost:1234) |
| Cache | Redis (PKCE verifiers, sessions) |
| Infrastructure | Docker Compose (7 services) |

## Age-Adaptive Modes

| Mode | Ages | Character |
|------|------|-----------|
| **Fun** | 8–10 | Bright colors, large rounded elements, playful language, confetti, emoji |
| **Balanced** | 11–13 | Clean visuals, moderate sizing, guided hints, progress badges |
| **Pro** | 14+ | Dark theme, compact layout, technical language, keyboard shortcuts |

Default is set by age during onboarding. Users can switch modes at any time via the theme selector.

## Project Structure

```
FireFly/
├── code/
│   ├── client/                # React + Vite + TypeScript SPA
│   │   ├── src/
│   │   │   ├── api/           # HTTP API client (client.ts)
│   │   │   ├── assets/        # Static assets
│   │   │   ├── components/
│   │   │   │   ├── ui/        # shadcn/ui primitives (do not manually edit)
│   │   │   │   ├── visualizer/ # Code stepper panes & controls
│   │   │   │   └── dashboard/  # Student progress widgets
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   ├── lib/           # AuthContext, ThemeContext, utilities
│   │   │   ├── pages/         # Route-level page components (8 pages)
│   │   │   └── types/         # TypeScript type definitions
│   │   ├── Dockerfile         # Multi-stage: build → Nginx alpine
│   │   ├── nginx.conf         # Reverse proxy config
│   │   ├── vite.config.js
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   └── server/                # Node.js + Fastify + TypeScript API
│       ├── prisma/
│       │   ├── schema.prisma  # 8 models, 4 enums
│       │   └── migrations/    # Prisma migration files
│       ├── src/
│       │   ├── config/        # env.ts, database.ts, redis.ts
│       │   ├── plugins/       # auth.ts, envelope.ts, request-id.ts
│       │   └── routes/        # health, admin, auth, curriculum, execution, mastery, llm
│       ├── Dockerfile         # Multi-stage: build → Node.js alpine
│       ├── tsconfig.json
│       └── package.json
│
├── docs/
│   ├── SPEC.md                # Product specification
│   ├── implementation-plan.md # Task-level implementation plan
│   ├── architecture/          # System architecture docs
│   ├── api/                   # API reference docs
│   └── guides/                # How-to guides
│
├── docker-compose.yml         # 7-service stack
├── .env.example               # Environment variable template (17 vars)
├── AGENTS.md                  # AI agent instructions
├── LICENSE
└── README.md
```

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) ≥ 20 (only for local development without Docker)
- [LM Studio](https://lmstudio.ai/) (optional, for AI features)

### Quick Start (Docker Compose)

```bash
# Clone and configure
git clone https://github.com/achingono/FireFly.git
cd FireFly
cp .env.example .env

# Start all 7 services
docker compose up -d

# Seed sample data (concepts, lessons, exercises)
curl -X POST -k https://localhost:8443/api/v1/admin/seed

# Open the app (note: accept the self-signed certificate warning)
open https://localhost:8443
```

**Security Note**: The app uses a self-signed TLS certificate for local development. Your browser will show a security warning — click "Advanced" → "Proceed to localhost (unsafe)" to continue. All traffic is encrypted through nginx TLS termination on port 8443.

### Default Login Credentials

The OIDC provider is pre-configured with a test account:

- **Email**: `admin@localhost`
- **Password**: `Divide-30-Weight`

### Development (Hot Reload)

For local development with hot reload, start only the infrastructure services in Docker and run the client and server natively:

```bash
# Start infrastructure only
docker compose up -d postgres redis judge0 judge0-workers oidc

# Server (terminal 1)
cd code/server
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev    # Fastify on http://localhost:3000

# Client (terminal 2)
cd code/client
npm install
npm run dev    # Vite on http://localhost:5173 (proxies /api to :3000)
```

### Enable AI Features

Start [LM Studio](https://lmstudio.ai/), load a model, and start the local server on port 1234. The app connects automatically via the `LLM_BASE_URL` environment variable.

### Environment Variables

The `.env.example` file contains all 17 required variables. Key settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://firefly:...@postgres:5432/firefly` | PostgreSQL connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `JUDGE0_URL` | `http://judge0:2358` | Judge0 API endpoint |
| `OIDC_ISSUER` | `http://oidc:9000` | OIDC provider URL |
| `OIDC_CLIENT_ID` | `firefly` | OIDC client identifier |
| `OIDC_REDIRECT_URI` | `http://localhost:3000/api/v1/auth/callback` | OAuth callback URL |
| `JWT_SECRET` | — | Secret key for JWT signing |
| `LLM_PROVIDER` | `openai` | LLM provider type |
| `LLM_BASE_URL` | `http://host.docker.internal:1234/v1` | LM Studio endpoint |
| `CLIENT_ORIGIN` | `http://localhost:80` | CORS origin for the client |
| `VITE_API_URL` | `http://localhost:3000/api/v1` | API URL for the client |

See [Getting Started Guide](docs/guides/getting-started.md) for the complete list.

## API Overview

All endpoints are under `/api/v1/`. Every response uses a standardized envelope:

```json
{
  "status": "success",
  "code": 200,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "data": { },
  "meta": { "schemaVersion": "1.0" }
}
```

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/admin/seed` | No | Seed database with sample data |
| GET | `/auth/login` | No | Initiate OIDC login (redirects to provider) |
| GET | `/auth/callback` | No | OIDC callback (exchanges code for tokens) |
| GET | `/auth/me` | Yes | Current user profile |
| POST | `/auth/refresh` | No | Refresh JWT using httpOnly cookie |
| POST | `/auth/onboard` | Yes | Complete onboarding (display name, age) |
| POST | `/auth/logout` | No | Clear session cookies |
| GET | `/concepts` | Yes | List all concepts |
| GET | `/concepts/:id` | Yes | Get concept details |
| POST | `/concepts` | Admin | Create concept |
| GET | `/lessons` | Yes | List lessons (filterable by concept) |
| GET | `/lessons/:id` | Yes | Get lesson with exercises |
| POST | `/lessons` | Admin | Create lesson |
| GET | `/exercises` | Yes | List exercises (filterable by lesson) |
| GET | `/exercises/:id` | Yes | Get exercise details |
| POST | `/exercises` | Admin | Create exercise |
| POST | `/execution/run` | Yes | Submit code for execution |
| GET | `/execution/jobs/:id` | Yes | Check execution job status |
| GET | `/execution/jobs/:id/trace` | Yes | Get execution trace |
| GET | `/progress/:userId` | Yes | Full mastery map |
| POST | `/progress/:userId/update` | Yes | Submit attempt (BKT update) |
| GET | `/progress/:userId/concept/:conceptId` | Yes | Concept mastery detail |
| POST | `/ai/explain` | Yes | AI code explanation |
| POST | `/ai/hint` | Yes | AI exercise hint (won't give solutions) |
| POST | `/ai/chat` | Yes | AI conversation |

See the [API Reference](docs/api/overview.md) for detailed request/response documentation.

## Key Features

### Visual Code Stepper

The core feature — an interactive, step-through visualization of Python code execution:

- **Code Pane** — source with current-line highlighting (Monaco Editor, read-only during replay)
- **Stack Pane** — call frames with local variable values at each step
- **Heap Pane** — objects, lists, and references displayed as cards
- **Output Pane** — stdout/stderr accumulated through execution
- **Controls** — step forward/backward, play/pause, speed slider, step counter, reset
- **AI Panel** — "Explain This Step" generates an age-appropriate explanation of the current execution state

### Mastery & Progression

- **Bayesian Knowledge Tracing (BKT)** scores each concept 0.0 – 1.0
- Mastery threshold: ≥ 0.80 to unlock dependent concepts
- Parameters: pL₀=0.10, pT=0.20, pG=0.25, pS=0.10
- Progress dashboard shows concept map with mastery levels and streaks

### AI Tutor

- Three modes: **explain** (code explanation), **hint** (guided help without solutions), **chat** (open conversation)
- Age-adapted system prompts automatically adjust language complexity
- Powered by any OpenAI-compatible API (LM Studio recommended for local development)

### Adaptive Theming

- **Fun Mode** (ages 8–10): bright colors, large text, rounded corners, playful tone
- **Balanced Mode** (ages 11–13): clean design, moderate sizing, guided experience
- **Pro Mode** (ages 14+): dark theme, compact layout, technical language
- Theme-aware CSS custom properties on `<html>` element, switchable at runtime

## Commands Reference

### Client (`code/client/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server (port 5173, proxies /api to 3000) |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint (quiet mode) |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run preview` | Preview production build |

### Server (`code/server/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start with tsx watch (auto-reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |
| `npx prisma generate` | Regenerate Prisma client |
| `npx prisma migrate dev` | Create new migration |
| `npx prisma migrate deploy` | Apply pending migrations |
| `npx prisma studio` | Open database GUI |

### Docker Compose

```bash
docker compose up -d              # Start all services
docker compose down                # Stop all services
docker compose up -d --build       # Rebuild after code changes
docker compose logs -f server      # Follow server logs
docker compose logs -f client      # Follow client logs
```

## Documentation

| Section | Path | Description |
|---------|------|-------------|
| **Architecture** | [`docs/architecture/`](docs/architecture/) | System overview, backend, frontend, database |
| **API Reference** | [`docs/api/`](docs/api/) | All 25 endpoints with request/response examples |
| **Guides** | [`docs/guides/`](docs/guides/) | Getting started, development, deployment, auth, theming, execution |
| **Specification** | [`docs/SPEC.md`](docs/SPEC.md) | Product specification |
| **Implementation** | [`docs/implementation-plan.md`](docs/implementation-plan.md) | Task-level implementation plan |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Run `npm run lint` in `code/client/` before committing client changes
4. Run `npm run build` in `code/server/` before committing server changes
5. Commit with imperative mood (e.g., `Add JWT auth middleware`)
6. Open a Pull Request with title format: `[area] Description`

## Credits & Acknowledgments

FireFly is built on the shoulders of brilliant open-source projects and tools:

**Frontend**
- [React](https://react.dev/) — UI library foundation
- [Vite](https://vitejs.dev/) — Lightning-fast build tool and dev server
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS framework for rapid UI development
- [shadcn/ui](https://ui.shadcn.com/) — High-quality, customizable React components
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — Code editor powering VS Code
- [Framer Motion](https://www.framer.com/motion/) — Smooth animation library
- [TanStack Query](https://tanstack.com/query/latest) — Server state management
- [react-router-dom](https://reactrouter.com/) — Client-side routing
- [react-hook-form](https://react-hook-form.com/) — Performant form handling
- [Zod](https://zod.dev/) — Schema validation
- [Lucide React](https://lucide.dev/) — Beautiful SVG icons

**Backend**
- [Node.js](https://nodejs.org/) — JavaScript runtime
- [Fastify](https://www.fastify.io/) — Fast, low-overhead web framework
- [TypeScript](https://www.typescriptlang.org/) — Type-safe JavaScript
- [Prisma](https://www.prisma.io/) — Modern ORM and schema management

**Infrastructure & Services**
- [PostgreSQL](https://www.postgresql.org/) — Reliable relational database
- [Redis](https://redis.io/) — In-memory data store for caching and sessions
- [Judge0](https://judge0.com/) — Cloud-based code execution engine
- [plainscope/simple-oidc-provider](https://github.com/plainscope/simple-oidc-provider) — Lightweight OIDC provider
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/) — Containerization and orchestration

**AI & Learning**
- [OpenAI API](https://openai.com/api/) — LLM foundation
- [LM Studio](https://lmstudio.ai/) — Local LLM inference
- [Python Tutor](https://pythontutor.com/) — Inspiration for the visual code stepper

**Development & Tooling**
- [TypeScript](https://www.typescriptlang.org/) — Type safety across the stack
- [ESLint](https://eslint.org/) — Code quality and consistency

Thank you to all contributors, maintainers, and the open-source community!

## License

See [LICENSE](LICENSE) for details.
