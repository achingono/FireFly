# Getting Started

This guide walks you through setting up the FireFly development environment and running the full platform locally.

## Prerequisites

- **Node.js** >= 20
- **Docker** and **Docker Compose** (for PostgreSQL, Redis, Judge0, OIDC)
- **Git**
- **LM Studio** (optional, for AI features)

## macOS: Enable cgroups v1 for Judge0

Judge0 uses `isolate` to sandbox code execution, which requires **cgroups v1**. Docker Desktop on macOS defaults to cgroups v2, which causes Judge0 workers to fail with `Status 13: Internal Error`.

> **This step is required on macOS.** Linux hosts using cgroups v1 natively can skip this section.

### Steps

1. **Quit Docker Desktop** completely (not just close the window).

2. **Edit `settings.json`** to enable the cgroups v1 compatibility flag:

   ```bash
   # Open the Docker Desktop settings file
   nano ~/Library/Group\ Containers/group.com.docker/settings.json
   ```

   Add `"DeprecatedCgroupv1": true` to the JSON object. If the file doesn't exist, create it:

   ```json
   {
     "DeprecatedCgroupv1": true
   }
   ```

   If the file already exists with other settings, add the key alongside them.

3. **Delete `settings-store.json`** so Docker Desktop regenerates it from `settings.json`:

   ```bash
   rm ~/Library/Group\ Containers/group.com.docker/settings-store.json
   ```

   > **Important**: Editing `settings-store.json` directly does NOT work — Docker Desktop overwrites it on startup. You must edit `settings.json` and delete `settings-store.json`.

4. **Start Docker Desktop.**

5. **Verify cgroups v1 is active:**

   ```bash
   docker info | grep "Cgroup Version"
   # Expected output: Cgroup Version: 1
   ```

   If it still shows `2`, ensure Docker Desktop fully restarted and that `settings-store.json` was deleted before starting.

### References

- [Judge0 issue #552](https://github.com/judge0/judge0/issues/552) — macOS Apple Silicon setup
- [Docker for Mac issue #7797](https://github.com/docker/for-mac/issues/7797) — cgroups v2 compatibility

### Apple Silicon Rosetta failure mode

The official `judge0/judge0` image used by this repository is `amd64`-only. On Apple Silicon, Docker Desktop may run it under Rosetta emulation, which can make even trivial submissions fail with:

```text
rosetta error: mmap_anonymous_rw mmap failed, size=1000
```

If you explicitly switch FireFly back to `EXECUTOR_PROVIDER=judge0` and see that error:

1. Disable **Use Rosetta for x86/amd64 emulation on Apple Silicon** in Docker Desktop.
2. Enable **cgroups v1** using the steps above.
3. Restart Docker Desktop and rerun `./start.sh`.

The Docker Compose stack now defaults to `EXECUTOR_PROVIDER=docker`, which runs Python and JavaScript in native multi-arch Docker containers and avoids this Judge0-on-Apple-Silicon failure mode for local development.

If you still need Judge0 locally after that, run FireFly on an `x86_64` Linux host or use a Judge0 build produced specifically for `arm64`.

## Quick Start with Docker Compose

The fastest way to run the full platform:

```bash
# Clone the repository
git clone <repo-url>
cd FireFly

# Copy environment variables
cp .env.example .env

# Start all services (Postgres, Redis, Judge0, OIDC, Server, Client)
docker compose up -d

# Optional: include Ollama services (ollama + ollama-init)
docker compose -f docker-compose.yml -f docker-compose.ollama.yml --profile ollama up -d

# Open the application
open http://localhost:80
```

The Docker/local bootstrap initializes the sample curriculum automatically when the database is empty.
For local Docker runs, the server also defaults to the native Docker executor for Python and JavaScript submissions.

The Docker Compose setup runs 7 services:
- **Client** (Nginx) on port 80
- **Server** (Fastify) on port 3000
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **Judge0** on port 2358
- **Judge0 Workers** (background)
- **OIDC Provider** on port 9000

### Run with Ollama profile

To run the stack with the optional Ollama services enabled:

```bash
docker compose -f docker-compose.yml -f docker-compose.ollama.yml --profile ollama up -d
```

If using Ollama in Docker Compose for AI endpoints, set:

```bash
LLM_PROVIDER=ollama
LLM_BASE_URL=http://ollama:11434
```

To stop including profile services:

```bash
docker compose -f docker-compose.yml -f docker-compose.ollama.yml --profile ollama down
```

## Development Setup (Hot Reload)

For active development with hot module replacement:

### 1. Start Infrastructure Services

```bash
# Start only the infrastructure (Postgres, Redis, Judge0, OIDC)
docker compose up -d postgres redis judge0 judge0-workers oidc
```

### 2. Set Up the Server

```bash
cd code/server

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Start dev server (port 3000)
npm run dev
```

### 3. Set Up the Client

```bash
cd code/client

# Install dependencies
npm install

# Start Vite dev server (port 5173)
npm run dev
```

### 4. Optional: Seed the Full Dev Dataset

The app already auto-initializes curriculum when `AUTO_SEED_DATA=true`. Use the admin seed endpoint only after signing in as an admin when you specifically want the extra demo users and full dev reset behavior.

### 5. Open the Application

Navigate to `http://localhost:5173` in your browser.

## First Login

1. Click **"Start Coding"** or **"Sign In"** on the home page
2. You'll be redirected to the OIDC provider login page
3. Use the default credentials:
   - **Email**: `admin@localhost`
   - **Password**: `Rays-93-Accident`
4. After login, you'll land on the **Onboarding** page
5. Set your display name, age, and role
6. Choose your theme mode (Fun, Balanced, or Pro)
7. You're in! Explore the curriculum, try exercises, or visit the dashboard.

## Environment Variables

The `.env.example` file contains all configuration with sensible defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `firefly` | Database user |
| `POSTGRES_PASSWORD` | `firefly` | Database password |
| `POSTGRES_DB` | `firefly` | Database name |
| `DATABASE_URL` | `postgresql://firefly:firefly@localhost:5432/firefly` | Full connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `JUDGE0_URL` | `http://localhost:2358` | Judge0 API URL |
| `OIDC_ISSUER` | `http://localhost:9000` | OIDC provider URL |
| `OIDC_CLIENT_ID` | `firefly` | OIDC client identifier |
| `OIDC_CLIENT_SECRET` | `firefly-secret` | OIDC client secret |
| `OIDC_REDIRECT_URI` | `http://localhost:3000/api/v1/auth/callback` | OAuth callback URL |
| `JWT_SECRET` | `super-secret-jwt-key-change-in-production` | JWT signing key |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime |
| `LLM_PROVIDER` | `lmstudio` | AI provider |
| `LLM_BASE_URL` | `http://localhost:1234` | LM Studio API URL |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `VITE_API_URL` | `http://localhost:3000/api/v1` | Client-side API URL |

> **Important**: When running everything through Docker Compose, the internal service hostnames differ from localhost. The `.env.example` file is configured for Docker Compose by default. For local development, you may need to adjust URLs to use `localhost`.

## Enabling AI Features

AI features (explain, hint, chat) require a running LLM server:

1. **Install LM Studio** from [lmstudio.ai](https://lmstudio.ai)
2. Download a model (e.g., Llama 2, Mistral, Phi)
3. Start the local server (default port 1234)
4. AI features will automatically connect

If you use Docker Compose Ollama instead of LM Studio, run `docker compose -f docker-compose.yml -f docker-compose.ollama.yml --profile ollama up -d` and use `LLM_BASE_URL=http://ollama:11434` for server-in-container setups.

The application works fully without AI — explain/hint/chat buttons will show errors if the LLM is unavailable, but all other features function normally.

## Verifying the Setup

After starting all services, verify everything is working:

```bash
# Health check
curl http://localhost:3000/api/v1/health
# Expected: {"status":"success","data":{"status":"ok","timestamp":"...","version":"1.0.0"}}

# Curriculum should be present automatically on a fresh database
curl http://localhost:3000/api/v1/concepts
# Expected: {"status":"success","data":[...]}

# Check Judge0
curl http://localhost:2358/about
# Expected: Judge0 version info
```

## Next Steps

- [Development Guide](./development.md) — Code style, conventions, adding features
- [Deployment Guide](./deployment.md) — Production Docker deployment
- [Authentication Guide](./authentication.md) — OIDC flow details
- [Theming Guide](./theming.md) — Customizing the adaptive UI
