#!/usr/bin/env bash
set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${BOLD}FireFly Quick Start${RESET}"
echo "────────────────────────────────────"

# ── Check Docker ──────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${RED}✗ Docker not found.${RESET} Install it from https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo -e "${RED}✗ Docker Compose v2 not found.${RESET} Install it from https://docs.docker.com/compose/install/"
  exit 1
fi

echo -e "${GREEN}✓ Docker found${RESET}"

# ── Parse flags ───────────────────────────────────────────────────────────────
WITH_OLLAMA=false
for arg in "$@"; do
  case $arg in
    --ollama) WITH_OLLAMA=true ;;
  esac
done

# ── Create .env if missing ────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  if [ ! -f ".env.example" ]; then
    echo -e "${RED}✗ .env.example not found. Are you in the firefly directory?${RESET}"
    exit 1
  fi

  echo "Creating .env from .env.example..."
  cp .env.example .env

  # Generate JWT secret automatically
  generate_secret() {
    openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n'
  }

  JWT_SECRET=$(generate_secret)
  sed -i.bak -e "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
  rm -f .env.bak

  echo -e "${GREEN}✓ .env created${RESET}"
else
  echo -e "${GREEN}✓ .env found${RESET}"
fi

# ── Start services ────────────────────────────────────────────────────────────
echo ""
if [ "$WITH_OLLAMA" = true ]; then
  echo "Starting all services (including Ollama)..."
  docker compose -f docker-compose.yml -f docker-compose.ollama.yml --profile ollama up -d
else
  echo "Starting services..."
  docker compose up -d
fi

# ── Wait for services ─────────────────────────────────────────────────────────
echo ""
echo "Waiting for services to be ready..."

TIMEOUT=90
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" "https://localhost:9443" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ] || [ "$STATUS" = "301" ]; then
    echo -e "${GREEN}✓ FireFly is up${RESET}"
    break
  fi
  printf "."
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo -e "\n${YELLOW}⚠ Still waiting... Services may need a moment more.${RESET}"
  echo "  Check status: docker compose ps"
  echo "  Check logs:   docker compose logs -f server"
fi

# ── Initial curriculum ────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}✓ Sample curriculum initializes automatically on first start${RESET}"

# ── Execution runtime smoke test ──────────────────────────────────────────────
echo ""
echo "Checking code execution runtime..."
EXECUTOR_PROVIDER=$(grep -E '^EXECUTOR_PROVIDER=' .env 2>/dev/null | tail -n1 | cut -d= -f2)
EXECUTOR_PROVIDER=${EXECUTOR_PROVIDER:-docker}

if [ "$EXECUTOR_PROVIDER" = "docker" ]; then
  EXEC_SMOKE=$(docker run --rm --network none --memory 128m --cpus 1 --pids-limit 64 python:3.12-alpine python3 -c "print(1)" 2>/dev/null || true)
  if [ "$EXEC_SMOKE" = "1" ]; then
    echo -e "${GREEN}✓ Native Docker executor is healthy${RESET}"
  else
    echo -e "${YELLOW}⚠ Native Docker executor smoke test did not pass cleanly.${RESET}"
    echo "  Raw response: ${EXEC_SMOKE}"
  fi
else
  JUDGE0_SMOKE=$(docker compose exec judge0 sh -lc "printf '%s' '{\"source_code\":\"print(1)\",\"language_id\":71}' >/tmp/judge0-smoke.json && wget -qO- --header='Content-Type: application/json' --post-file=/tmp/judge0-smoke.json 'http://127.0.0.1:2358/submissions?base64_encoded=false&wait=true'" 2>/dev/null || true)
  if echo "$JUDGE0_SMOKE" | grep -q '"status":{"id":3'; then
    echo -e "${GREEN}✓ Judge0 runtime is healthy${RESET}"
  elif echo "$JUDGE0_SMOKE" | grep -qi "rosetta error"; then
    DOCKER_ARCH=$(docker version --format '{{.Architecture}}' 2>/dev/null || echo "unknown")
    CGROUP_VERSION=$(docker info --format '{{.CgroupVersion}}' 2>/dev/null || echo "unknown")
    echo -e "${RED}✗ Judge0 execution is unavailable in this Docker setup${RESET}"
    echo "  Judge0 is running under Rosetta emulation on an Apple Silicon host."
    echo "  Docker server arch: ${DOCKER_ARCH}"
    echo "  Cgroup version:    ${CGROUP_VERSION}"
    echo "  Fix:"
    echo "    1. Disable 'Use Rosetta for x86/amd64 emulation on Apple Silicon' in Docker Desktop."
    echo "    2. Enable cgroups v1 as documented in docs/guides/getting-started.md."
    echo "    3. Restart Docker Desktop and rerun ./start.sh."
  else
    echo -e "${YELLOW}⚠ Judge0 smoke test did not pass cleanly.${RESET}"
    echo "  Raw response: ${JUDGE0_SMOKE}"
  fi
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}FireFly is ready!${RESET}"
echo "────────────────────────────────────"
echo ""
echo "  URL:      https://localhost:9443"
echo "  Email:    admin@localhost"
echo "  Password: Divide-30-Weight"
echo ""
echo "  ⚠ Accept the self-signed certificate warning in your browser."
echo "    Click 'Advanced' → 'Proceed to localhost (unsafe)'"
echo ""

if [ "$WITH_OLLAMA" = true ]; then
  echo "  Ollama:   Running (AI features enabled)"
else
  echo "  AI features: Disabled by default."
  echo "  To enable: ./start.sh --ollama"
  echo "  Or point LLM_BASE_URL in .env to an OpenAI-compatible endpoint."
fi

echo ""
echo "Docs: https://github.com/achingono/firefly/tree/main/docs"
echo ""

# Try to open browser
if command -v open &>/dev/null; then
  open "https://localhost:9443"
elif command -v xdg-open &>/dev/null; then
  xdg-open "https://localhost:9443" &>/dev/null &
fi
