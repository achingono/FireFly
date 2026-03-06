# FireFly – Kids Learn Code By Seeing It Run

**Write code. Watch it execute. Understand, don't guess.**

Most programming tutorials are walls of text. Kids copy code, it works (sometimes), and they have no idea why. FireFly is different.

FireFly is **Python Tutor meets AI tutor** — built for ages 8 and up. Kids write real programs, watch them execute line-by-line with visual animation, get hints when stuck, and unlock new concepts only when they genuinely understand.

> ⚠️ **Early stage.** Core visual stepper, mastery tracking, and AI tutor are working. More languages and teacher dashboards are planned.

---

## How It Works

1. **Write real code** — Python in a full Monaco editor (same engine as VS Code)
2. **See it run** — Every line executes with visual feedback: variables, stack, heap, output
3. **Get unstuck** — AI tutor gives age-appropriate hints (no solutions handed out)
4. **Prove understanding** — Concepts unlock only after ≥80% mastery (Bayesian Knowledge Tracing)
5. **Level up** — Harder concepts unlock automatically as you master prerequisites

---

## Why Kids Learn Faster

| Traditional tutorials | FireFly |
|---|---|
| Read text, copy code, hope it works | Watch code execute line-by-line |
| No feedback on *why* something failed | See exactly where and why it broke |
| Move on before understanding | Master before advancing |
| One-size-fits-all difficulty | Adapts to your age and level |
| No help when stuck | AI tutor available 24/7 |

**Before FireFly:** Kids follow tutorials, copy code, don't understand.
**After FireFly:** Kids write code, see execution, understand why.

---

## Age-Adaptive Modes

| Mode | Ages | Experience |
|------|------|-----------|
| **Fun** | 8–10 | Bright colors, large text, playful language, confetti, emoji |
| **Balanced** | 11–13 | Clean design, guided hints, progress badges |
| **Pro** | 14+ | Dark theme, compact layout, technical language, keyboard shortcuts |

Set during onboarding. Switchable at any time.

---

## Quick Start

```bash
git clone https://github.com/achingono/firefly.git
cd firefly
./start.sh
```

Open **https://localhost:9443** — accept the self-signed certificate warning.

**Default login:**
- Email: `admin@localhost`
- Password: `Divide-30-Weight`

> Seed sample data after first login:
> ```bash
> curl -X POST -k https://localhost:9443/api/v1/admin/seed
> ```

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- 4 GB RAM minimum
- Optional: [LM Studio](https://lmstudio.ai/) or [Ollama](https://ollama.com/) for AI features

### With AI Features (Ollama)

```bash
docker compose -f docker-compose.yml -f docker-compose.ollama.yml --profile ollama up -d
```

### Development (Hot Reload)

```bash
# Start infrastructure only
docker compose up -d postgres redis judge0 judge0-workers oidc

# Terminal 1 — server
cd code/server && npm install && npx prisma generate && npx prisma migrate deploy && npm run dev

# Terminal 2 — client
cd code/client && npm install && npm run dev
```

---

## What's Implemented

- ✅ Visual code stepper — line-by-line Python execution with stack, heap, variable, and output panes
- ✅ Age-adaptive UI — Fun / Balanced / Pro modes
- ✅ Bayesian Knowledge Tracing — mastery-based progression (≥80% to unlock next concept)
- ✅ AI tutor — explain, hint, and chat modes (OpenAI-compatible)
- ✅ Authentication — OIDC + JWT (access 15min, refresh 7d)
- ✅ Sandboxed code execution — Judge0 + Python sys.settrace tracer
- ✅ Docker Compose deployment — 7 services, one command
- ⏳ More languages — JavaScript, Java, others (planned)
- ⏳ Teacher dashboard — classroom management (planned)
- ⏳ Curriculum builder — create custom lessons (planned)
- ⏳ Community lessons — shared by educators (planned)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite + TypeScript)             :80/:5173 │
│  ├── Monaco Code Editor                                     │
│  ├── Visual Stepper (Code / Stack / Heap / Output panes)   │
│  ├── AI Tutor Panel                                         │
│  └── Adaptive UI Engine (Fun / Balanced / Pro themes)       │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────────┐
│  Backend API (Node.js + Fastify + TypeScript)        :3000  │
│  ├── Auth (OIDC + JWT)                                      │
│  ├── Curriculum CRUD                                        │
│  ├── Progress & Mastery (BKT)                               │
│  ├── Execution orchestrator → Judge0                        │
│  ├── Python tracer (sys.settrace) → JSON trace frames       │
│  └── LLM proxy (OpenAI-compatible, age-adapted prompts)     │
└──────┬──────────────┬──────────────┬──────────┬─────────────┘
       │              │              │          │
  PostgreSQL       Redis          Judge0      OIDC
  (Prisma ORM)  (sessions/cache) (execution) (auth)
```

See [Architecture Docs](docs/architecture/) for full detail.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| Editor | Monaco Editor |
| Backend | Node.js, Fastify, TypeScript |
| ORM | Prisma + PostgreSQL |
| Auth | OIDC + JWT |
| Code Execution | Judge0 + Python sys.settrace |
| AI / LLM | OpenAI-compatible (LM Studio or Ollama) |
| Cache | Redis |
| Infrastructure | Docker Compose |

---

## Who Should Use FireFly?

- **Parents** teaching kids programming at home
- **Teachers** in schools, coding bootcamps, or after-school programs
- **Homeschool programs** looking for interactive coding curriculum
- **Self-learners** aged 8–18 who want to truly understand Python
- **Educators** who care about privacy (runs locally, fully open source)

---

## Documentation

| Section | Path | Description |
|---------|------|-------------|
| Architecture | [`docs/architecture/`](docs/architecture/) | System overview, backend, frontend, database |
| API Reference | [`docs/api/`](docs/api/) | All endpoints with request/response examples |
| Guides | [`docs/guides/`](docs/guides/) | Getting started, development, deployment, auth, theming |
| Specification | [`docs/SPEC.md`](docs/SPEC.md) | Product specification |
| Implementation | [`docs/implementation-plan.md`](docs/implementation-plan.md) | Task-level plan |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Run `npm run lint` in `code/client/` before committing client changes
4. Run `npm run build` in `code/server/` before committing server changes
5. Commit with imperative mood: `Add JWT auth middleware`
6. Open a PR with title format: `[area] Description`

---

## Credits

FireFly builds on brilliant open-source work:

[React](https://react.dev/) · [Vite](https://vitejs.dev/) · [Tailwind CSS](https://tailwindcss.com/) · [shadcn/ui](https://ui.shadcn.com/) · [Monaco Editor](https://microsoft.github.io/monaco-editor/) · [Framer Motion](https://www.framer.com/motion/) · [Fastify](https://www.fastify.io/) · [Prisma](https://www.prisma.io/) · [Judge0](https://judge0.com/) · [Python Tutor](https://pythontutor.com/) (inspiration) · [Ollama](https://ollama.com/) · [LM Studio](https://lmstudio.ai/)

---

## License

See [LICENSE](LICENSE) for details.
