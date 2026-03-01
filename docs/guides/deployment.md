# Deployment Guide

FireFly runs as a multi-service Docker Compose stack. This guide covers the full deployment architecture, configuration, and production considerations.

## Docker Compose Architecture

The `docker-compose.yml` defines 7 services:

```yaml
services:
  postgres:     # PostgreSQL 16 database
  redis:        # Redis 7 Alpine cache/session store
  judge0:       # Judge0 CE API (code execution)
  judge0-workers: # Judge0 worker processes
  oidc:         # simple-oidc-provider (authentication)
  server:       # Fastify API server
  client:       # Nginx serving React SPA
```

### Service Details

| Service | Image | Ports | Depends On |
|---------|-------|-------|------------|
| `postgres` | `postgres:16-alpine` | 5432 | — |
| `redis` | `redis:7-alpine` | 6379 | — |
| `judge0` | `judge0/judge0:latest` | 2358 | postgres, redis |
| `judge0-workers` | `judge0/judge0:latest` | — | postgres, redis |
| `oidc` | `ghcr.io/plainscope/simple-oidc-provider` | 9000 | — |
| `server` | Build: `code/server/Dockerfile` | 3000 | postgres, redis, judge0, oidc |
| `client` | Build: `code/client/Dockerfile` | 80 | server |

### Network Architecture

All services are on the same Docker network. Internal service names resolve as hostnames:

```
Client (Nginx :80)
  ├── Static files (React SPA)
  └── /api/* → proxy to server:3000

Server (Fastify :3000)
  ├── → postgres:5432  (database)
  ├── → redis:6379     (cache/sessions)
  ├── → judge0:2358    (code execution)
  └── → oidc:9000      (authentication)

Judge0 (:2358)
  ├── → postgres:5432  (job queue)
  └── → redis:6379     (caching)
```

## Dockerfiles

### Server Dockerfile (`code/server/Dockerfile`)

Three-stage build:

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Stage 2: Build TypeScript
FROM deps AS builder
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

**Key points**:
- Prisma client is generated during build
- Migrations run on container startup (before the server starts)
- Only the compiled `dist/` directory is included in the final image

### Client Dockerfile (`code/client/Dockerfile`)

Three-stage build:

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build React app
FROM deps AS builder
COPY . .
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 3: Serve with Nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Key points**:
- `VITE_API_URL` is baked in at build time (Vite replaces `import.meta.env` during build)
- The production image is just Nginx Alpine — no Node.js runtime needed
- Nginx serves static files and proxies API requests

### Nginx Configuration (`code/client/nginx.conf`)

```nginx
server {
    listen 80;

    # API proxy
    location /api/ {
        proxy_pass http://server:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;  # SPA fallback
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Running Docker Compose

### Full Stack

```bash
# Start everything
docker compose up -d

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f server

# Stop everything
docker compose down

# Stop and remove volumes (destroys data)
docker compose down -v
```

### Build and Restart

```bash
# Rebuild after code changes
docker compose build server client

# Restart with fresh builds
docker compose up -d --build
```

### Infrastructure Only (for local development)

```bash
# Start only databases and external services
docker compose up -d postgres redis judge0 judge0-workers oidc

# Run server and client locally with hot reload
cd code/server && npm run dev &
cd code/client && npm run dev &
```

## Environment Configuration

### Docker Compose Environment Variables

The `.env` file in the repository root is read by Docker Compose. Key variables:

```bash
# Database
POSTGRES_USER=firefly
POSTGRES_PASSWORD=firefly
POSTGRES_DB=firefly
DATABASE_URL=postgresql://firefly:firefly@postgres:5432/firefly

# Redis
REDIS_URL=redis://redis:6379

# Judge0
JUDGE0_URL=http://judge0:2358

# OIDC
OIDC_ISSUER=http://oidc:9000
OIDC_CLIENT_ID=firefly
OIDC_CLIENT_SECRET=firefly-secret
OIDC_REDIRECT_URI=http://localhost:3000/api/v1/auth/callback

# JWT
JWT_SECRET=super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# AI
LLM_PROVIDER=lmstudio
LLM_BASE_URL=http://host.docker.internal:1234

# Client
CLIENT_ORIGIN=http://localhost:80
VITE_API_URL=/api/v1
```

> **Note**: Inside Docker, services reference each other by service name (`postgres`, `redis`, `judge0`, `oidc`, `server`). For LM Studio running on the host, use `host.docker.internal`.

## Data Persistence

### Volumes

Docker Compose uses named volumes for data persistence:

| Volume | Service | Purpose |
|--------|---------|---------|
| `postgres_data` | postgres | Database files |
| `redis_data` | redis | Redis persistence |

### Backup

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U firefly firefly > backup.sql

# Restore PostgreSQL
docker compose exec -i postgres psql -U firefly firefly < backup.sql
```

## Database Management

### Running Migrations

Migrations run automatically on server startup. To run manually:

```bash
# Inside container
docker compose exec server npx prisma migrate deploy

# Or from host (requires DATABASE_URL pointing to localhost:5432)
cd code/server && npx prisma migrate deploy
```

### Seeding Data

```bash
# Seed via API
curl -X POST http://localhost:3000/api/v1/admin/seed

# Or through Docker
docker compose exec server curl -X POST http://localhost:3000/api/v1/admin/seed
```

### Prisma Studio

```bash
# Open database browser (from host)
cd code/server
DATABASE_URL=postgresql://firefly:firefly@localhost:5432/firefly npx prisma studio
```

## Health Checks

Verify all services are running:

```bash
# Application health
curl http://localhost:3000/api/v1/health

# Judge0 health
curl http://localhost:2358/about

# PostgreSQL
docker compose exec postgres pg_isready -U firefly

# Redis
docker compose exec redis redis-cli ping
```

## Production Considerations

### Security

- **Change `JWT_SECRET`** — Use a strong random string (64+ characters)
- **Change database passwords** — Don't use the defaults
- **Enable HTTPS** — Put a reverse proxy (Caddy, Traefik) in front of the client
- **Restrict OIDC** — Configure the OIDC provider appropriately for production
- **Set `NODE_ENV=production`** — Enables secure cookie attributes
- **Rate limiting** — Configure per-endpoint rate limits for execution and AI endpoints

### Performance

- **Judge0 workers** — Scale `judge0-workers` replicas based on expected concurrent code executions
- **Redis** — Configure `maxmemory` and eviction policy for production workloads
- **PostgreSQL** — Tune `shared_buffers`, `work_mem` based on available memory
- **Nginx** — Enable gzip compression, configure worker processes

### Monitoring

- All API responses include `requestId` for tracing
- Server logs include request timing and status codes
- Judge0 provides execution metrics via its API

## Troubleshooting

### Services Won't Start

```bash
# Check which services are running
docker compose ps

# Check logs for errors
docker compose logs <service-name>

# Restart a specific service
docker compose restart <service-name>
```

### Database Connection Failed

```bash
# Verify PostgreSQL is ready
docker compose exec postgres pg_isready -U firefly

# Check DATABASE_URL in server environment
docker compose exec server env | grep DATABASE_URL
```

### Judge0 Not Responding

```bash
# Check Judge0 logs
docker compose logs judge0 judge0-workers

# Verify Judge0 API
curl http://localhost:2358/about

# Judge0 needs Docker socket — ensure privileged mode or proper socket mount
```

### OIDC Login Redirects to Wrong URL

Check these environment variables:
- `OIDC_REDIRECT_URI` — Must match what the OIDC provider expects
- `CLIENT_ORIGIN` — Must match the URL where the browser accesses the client
- The OIDC callback URL must be accessible from the browser, not just from Docker

## Related Documentation

- [Getting Started](./getting-started.md)
- [Architecture Overview](../architecture/overview.md)
- [Authentication Guide](./authentication.md)
