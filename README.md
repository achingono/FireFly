# FireFly

An AI-powered, mastery-based coding education platform for kids that **visually steps through code execution**, adapts to the learner's age, and teaches programming concepts through demonstrated understanding.

---

## What Is FireFly?

FireFly is a web platform where children (ages 8+) learn to code by writing real programs, watching them execute step-by-step, and building genuine understanding before moving on. It combines:

- **A visual code stepper** (the core feature) — line-by-line execution with animated stack, heap, variable, and I/O panels inspired by [Python Tutor](https://pythontutor.com)
- **Mastery-based progression** — concepts unlock only after the learner demonstrates ≥ 80% understanding
- **An AI tutor** — context-aware hints and explanations grounded in the actual execution trace
- **Age-adaptive UI** — three modes (Fun / Balanced / Pro) that automatically adjust visuals, tone, and complexity
- **Creative memory animations** (bonus) — metaphorical or realistic views of what's happening inside the computer's memory

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite + TypeScript)                      │
│  ├── Monaco Code Editor                                    │
│  ├── Visual Stepper (Code / Stack / Heap / Output panes)   │
│  ├── Memory Animation (PixiJS / Three.js)                  │
│  ├── AI Tutor Sidebar                                      │
│  └── Adaptive UI Engine (Fun / Balanced / Pro themes)      │
└───────────────────────┬────────────────────────────────────┘
                        │ REST + WebSocket
┌───────────────────────▼────────────────────────────────────┐
│  Backend API (Node.js + Fastify + TypeScript)              │
│  ├── Auth (JWT + role-based access)                        │
│  ├── Curriculum, Lesson & Exercise services                │
│  ├── Progress & Mastery (Bayesian Knowledge Tracing)       │
│  ├── Execution orchestrator → Judge0                       │
│  ├── Trace generator & transformer                         │
│  └── LLM proxy (configurable: OpenAI / Anthropic / local) │
└──────┬──────────────┬──────────────┬───────────────────────┘
       │              │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼──────┐
│ PostgreSQL  │ │   Redis   │ │  Judge0    │
│ (data)      │ │ (cache,   │ │ (sandboxed │
│             │ │  sessions)│ │  execution)│
└─────────────┘ └───────────┘ └────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| Editor | Monaco Editor |
| Animations | PixiJS (2D), Three.js (3D) |
| Backend | Node.js, Fastify, TypeScript |
| Database | PostgreSQL (relational data), Redis (sessions, cache) |
| Auth | JWT (access + refresh tokens) |
| Code Execution | Self-hosted Judge0 (primary), OneCompiler API (SaaS fallback) |
| AI / LLM | Pluggable proxy — OpenAI (default), Anthropic, or local models |
| Dev Infra | Docker Compose |

## Age-Adaptive Modes

| Mode | Ages | Character |
|------|------|-----------|
| **Fun** | 8–10 | Bright colors, mascots, confetti, story-driven worlds, sound effects, "Let's Go!" buttons |
| **Balanced** | 11–13 | Clean visuals, optional friendly icons, guided hints, progress badges |
| **Pro** | 14+ | Dark IDE theme, minimal animations, memory addresses, keyboard shortcuts, hex dumps |

Default is set by age at signup. Kids and parents can switch modes at any time.

## Project Structure

```
FireFly/
├── code/
│   ├── client/                # React + Vite + TypeScript SPA
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/        # shadcn/ui primitives
│   │   │   │   ├── visualizer/ # Code stepper panes & controls
│   │   │   │   └── dashboard/  # Progress & mastery widgets
│   │   │   ├── pages/         # Route-level page components
│   │   │   ├── lib/           # Contexts, auth, utils
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   ├── api/           # API client
│   │   │   └── assets/        # Static assets
│   │   ├── index.html
│   │   ├── vite.config.js
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   └── server/                # Node.js + Fastify + TypeScript API
│       ├── src/
│       │   ├── routes/        # Fastify route handlers
│       │   ├── controllers/   # Business logic
│       │   ├── services/      # Execution, mastery, LLM
│       │   ├── models/        # Database models
│       │   ├── middleware/     # Auth, error handling, request tracing
│       │   ├── schemas/       # Zod / JSON Schema validation
│       │   └── config/        # Environment, database, Judge0
│       ├── prisma/            # Database schema & migrations
│       ├── tsconfig.json
│       └── package.json
│
├── docs/
│   ├── SPEC.md                # Consolidated product specification
│   ├── implementation-plan.md # implementation plan
│
├── docker-compose.yml         # Full local stack
├── .env.example               # Environment variable template
├── LICENSE
└── README.md
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [Docker](https://www.docker.com/) and Docker Compose
- [Git](https://git-scm.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/achingono/FireFly.git
cd FireFly
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database
POSTGRES_USER=firefly
POSTGRES_PASSWORD=firefly_dev
POSTGRES_DB=firefly
DATABASE_URL=postgresql://firefly:firefly_dev@localhost:5432/firefly

# Redis
REDIS_URL=redis://localhost:6379

# Judge0 (code execution)
JUDGE0_URL=http://localhost:2358

# LLM (pick one)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Client
VITE_API_URL=http://localhost:3000/api/v1
```

### 3. Start the Full Stack (Docker Compose)

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** (port 5432) — relational data
- **Redis** (port 6379) — sessions and cache
- **Judge0** (port 2358) — sandboxed code execution
- **API server** (port 3000) — Fastify backend
- **Client dev server** (port 5173) — Vite + React frontend

### 4. Run Without Docker (Development)

**Backend:**

```bash
cd code/server
npm install
npm run dev          # Starts Fastify on port 3000
```

**Frontend:**

```bash
cd code/client
npm install
npm run dev          # Starts Vite on port 5173
```

> Requires Postgres, Redis, and Judge0 running separately or via `docker compose up postgres redis judge0`.

### 5. Seed Sample Data

```bash
curl -X POST http://localhost:3000/api/v1/admin/seed
```

Creates sample users, concepts, lessons, and exercises for local testing.

### 6. Open the App

Visit [http://localhost:5173](http://localhost:5173) in your browser.

## API Overview

All responses use a standardized envelope:

```json
{
  "status": "success",
  "code": 200,
  "requestId": "uuid-v4",
  "data": {},
  "meta": { "schemaVersion": "1.0" }
}
```

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register (email, password, role, age) |
| POST | `/api/v1/auth/login` | Login → JWT token |
| GET | `/api/v1/concepts` | List curriculum concepts |
| GET | `/api/v1/lessons/:id` | Lesson content & exercises |
| POST | `/api/v1/execution/run` | Execute code in sandbox |
| GET | `/api/v1/execution/jobs/:id/trace` | Get execution trace for stepper |
| POST | `/api/v1/visualizer/explain` | AI explanation of a trace step |
| GET | `/api/v1/progress/:userId` | Mastery map per concept |

See [docs/SPEC.md](docs/SPEC.md) for the complete API contract, trace schema, and data model.

## Key Features

### Visual Code Stepper (Primary)

The stepper renders execution traces as interactive, step-through visualizations:

- **Code Pane** — source with current-line highlighting and breakpoints
- **Stack Pane** — call frames with local variable values
- **Heap Pane** — objects and references as a graph with pointer arrows
- **Output Pane** — stdout/stderr accumulated through execution
- **Controls** — play, pause, step forward/backward, speed slider, jump to any step
- **"Explain This Step"** — AI generates an age-appropriate explanation of the current state

### Memory Animation (Bonus)

An optional layer mapping trace data to animated visuals:

- **Fun Mode (Memory City)** — RAM as a colorful pixel city, variables as dancing characters, pointers as glowing bridges
- **Pro Mode (Memory Lab)** — realistic memory grid with addresses, precise arrows, optional hex dump

### Mastery & Progression

- Bayesian Knowledge Tracing scores each concept 0.0 – 1.0
- Threshold: ≥ 0.80 + transfer check to unlock next concept
- Remediation: targeted micro-lessons, visual walkthroughs, scaffolded hints

## Documentation

| Document | Description |
|----------|-------------|
| [docs/SPEC.md](docs/SPEC.md) | **Consolidated product specification** (single source of truth) |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Detailed implementation plan |

## Roadmap

| Phase | Timeline | Focus |
|-------|----------|-------|
| **1 — MVP** | Weeks 1–9 | Auth, editor, Judge0 execution, visual stepper, adaptive themes, 5 sample lessons |
| **2 — AI & Adaptive** | Weeks 10–15 | LLM integration, BKT mastery scoring, teacher/parent dashboard |
| **3 — Polish** | Weeks 16–19 | Memory animations, JS support, accessibility audit, beta testing |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

See [LICENSE](LICENSE) for details.
