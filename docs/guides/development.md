# Development Guide

This guide covers code conventions, project structure, and workflows for developing FireFly.

## Project Structure

```
FireFly/
├── code/
│   ├── client/          # React + Vite + TypeScript SPA
│   │   ├── src/
│   │   │   ├── api/           # HTTP API client
│   │   │   ├── assets/        # Static assets
│   │   │   ├── components/
│   │   │   │   ├── ui/        # shadcn/ui primitives (auto-generated)
│   │   │   │   ├── visualizer/# Code stepper panes
│   │   │   │   └── dashboard/ # Progress widgets
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   ├── lib/           # Contexts, utilities
│   │   │   ├── pages/         # Route-level components
│   │   │   └── types/         # TypeScript type definitions
│   │   ├── vite.config.js
│   │   ├── tailwind.config.js
│   │   └── Dockerfile
│   │
│   └── server/          # Fastify + TypeScript API
│       ├── prisma/            # Schema and migrations
│       ├── src/
│       │   ├── config/        # Env, database, Redis
│       │   ├── plugins/       # Fastify plugins (auth, envelope, request-id)
│       │   └── routes/        # API route modules
│       ├── tsconfig.json
│       └── Dockerfile
│
├── docs/                # Documentation
├── docker-compose.yml   # Full stack orchestration
├── .env.example         # Environment variable template
├── AGENTS.md            # AI agent instructions
└── README.md
```

## Code Conventions

### General Rules

- **TypeScript** everywhere (`.tsx` for React components, `.ts` for everything else)
- **Functional components** with React hooks — no class components
- **`@/` path alias** for all imports from `src/` (configured in `vite.config.js` and `tsconfig.json`)
- Prefix unused variables with `_`
- Semicolons and double quotes (project default)
- All timestamps as ISO 8601 UTC strings

### Client Conventions

| Aspect | Convention |
|--------|-----------|
| File naming | `kebab-case.tsx` (e.g., `stepper-controls.tsx`) |
| Component naming | PascalCase (e.g., `StepperControls`) |
| Component library | shadcn/ui (New York style) |
| Styling | Tailwind CSS with CSS custom properties |
| State management | React Context (auth, theme), TanStack Query (server state) |
| Routing | React Router v6, routes in `pages.config.ts` |
| Icons | Lucide React |
| Forms | react-hook-form + Zod |
| Animation | Framer Motion |
| Code editor | Monaco Editor (`@monaco-editor/react`) |

### Server Conventions

| Aspect | Convention |
|--------|-----------|
| Framework | Fastify with TypeScript |
| Validation | Zod on request bodies |
| ORM | Prisma with PostgreSQL |
| Response format | Standardized envelope via `reply.envelope()` / `reply.envelopeError()` |
| Auth | JWT (access + refresh) via `@fastify/jwt` + `@fastify/cookie` |
| Request tracing | UUID v4 via `X-Request-Id` header |

## Available Commands

### Client (`code/client/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (port 5173, proxies `/api` to 3000) |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | Run ESLint (quiet mode) |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run preview` | Preview production build |

### Server (`code/server/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start with `tsx watch` (auto-reload on changes) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |
| `npx prisma generate` | Regenerate Prisma client |
| `npx prisma migrate dev` | Create new migration |
| `npx prisma migrate deploy` | Apply pending migrations |
| `npx prisma studio` | Open Prisma Studio (database GUI) |

## Adding a New API Endpoint

### 1. Create or Update Route Module

Add your route handler in `code/server/src/routes/`:

```typescript
import { FastifyInstance } from "fastify";
import { prisma } from "../config/database";

export default async function myRoutes(fastify: FastifyInstance) {
  // Public endpoint
  fastify.get("/my-resource", async (request, reply) => {
    const data = await prisma.myModel.findMany();
    return reply.envelope(data);
  });

  // Protected endpoint
  fastify.get("/my-resource/:id", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await prisma.myModel.findUnique({ where: { id } });
    if (!item) {
      return reply.envelopeError(404, "NotFoundError", "Resource not found");
    }
    return reply.envelope(item);
  });

  // Admin-only endpoint
  fastify.post("/my-resource", {
    preHandler: [fastify.authenticate, fastify.requireRole("admin")],
  }, async (request, reply) => {
    const body = request.body as { name: string };
    const item = await prisma.myModel.create({ data: body });
    return reply.code(201).envelope(item);
  });
}
```

### 2. Register the Route

In `code/server/src/index.ts`:

```typescript
import myRoutes from "./routes/my-routes";

// Inside the bootstrap function, after other route registrations:
fastify.register(myRoutes, { prefix: "/api/v1" });
```

### 3. Add Prisma Model (if needed)

Update `code/server/prisma/schema.prisma`:

```prisma
model MyModel {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Then run:
```bash
npx prisma migrate dev --name add-my-model
```

## Adding a New Page

### 1. Create Page Component

Create `code/client/src/pages/my-page.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";

export default function MyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-resource"],
    queryFn: () => api.entities.myResource.list(),
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="ff-text-heading font-bold mb-4">My Page</h1>
      {/* Page content */}
    </div>
  );
}
```

### 2. Add Route

In `code/client/src/pages.config.ts`:

```typescript
import MyPage from "./pages/my-page";

export const PAGES = {
  // ... existing pages
  MyPage: { path: "/my-page", component: MyPage },
};
```

The page will automatically be protected (requires auth + onboarding) unless added to `PUBLIC_PAGES`.

## Adding a shadcn/ui Component

```bash
cd code/client
npx shadcn@latest add <component-name>
```

This generates the component in `src/components/ui/`. Never manually edit these files.

## API Client Usage

The client-side API client (`src/api/client.ts`) provides typed methods:

```typescript
import api from "@/api/client";

// CRUD operations (generic entity proxy)
const concepts = await api.entities.concepts.list();
const concept = await api.entities.concepts.get(id);
const newConcept = await api.entities.concepts.create({ name: "..." });

// Execution
const job = await api.execution.run({ code: "print('hi')", language: "python" });
const status = await api.execution.status(job.id);
const trace = await api.execution.trace(job.id);

// Mastery
const mastery = await api.progress.masteryMap(userId);
const update = await api.progress.submit(userId, { conceptId, exerciseId, correct: true });

// AI
const explanation = await api.ai.explain({ code: "...", mode: "balanced" });
const hint = await api.ai.hint({ code: "...", exerciseTitle: "...", exerciseDescription: "..." });
```

## Theme-Aware Styling

Use the FireFly utility classes for theme-responsive sizing:

```tsx
// Font sizes that adapt to age mode
<h1 className="ff-text-heading">Title</h1>     // Fun: 2rem, Balanced: 1.75rem, Pro: 1.5rem
<p className="ff-text-base">Body text</p>        // Fun: 1.125rem, Balanced: 1rem, Pro: 0.875rem
<span className="ff-text-sm">Small text</span>   // Adapts per mode

// Border radius that adapts
<div className="ff-rounded">Rounded box</div>    // Fun: 1rem, Balanced: 0.625rem, Pro: 0.375rem
```

See the [Theming Guide](./theming.md) for full details.

## Git Workflow

### Commit Messages

Use imperative mood, concise descriptions:

```
Add JWT auth middleware
Wire curriculum page to real API
Fix BKT mastery calculation edge case
```

### PR Titles

Format: `[area] Description`

```
[server] Add auth routes
[client] Replace textarea with Monaco editor
[infra] Add Judge0 to Docker Compose
[docs] Add API reference documentation
```

### Pre-Commit Checklist

```bash
# Client
cd code/client
npm run lint        # Check for lint errors
npm run build       # Verify production build

# Server
cd code/server
npm run build       # Verify TypeScript compilation
```

## Debugging Tips

### Server Logs

The Fastify server logs all requests with request IDs. Filter by request ID to trace a specific request.

### Database

Use Prisma Studio for a visual database browser:

```bash
cd code/server
npx prisma studio    # Opens at http://localhost:5555
```

### Judge0

Check Judge0 directly for execution issues:

```bash
# Check Judge0 status
curl http://localhost:2358/about

# Submit code directly
curl -X POST http://localhost:2358/submissions \
  -H "Content-Type: application/json" \
  -d '{"source_code": "print(42)", "language_id": 71}'
```

### Redis

Inspect Redis for PKCE verifiers or cached data:

```bash
docker compose exec redis redis-cli
> KEYS *
> GET pkce:<state>
```

## Related Documentation

- [Getting Started](./getting-started.md)
- [Deployment Guide](./deployment.md)
- [Architecture Overview](../architecture/overview.md)
- [API Overview](../api/overview.md)
