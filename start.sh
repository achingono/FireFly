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

# ── Seed sample data ──────────────────────────────────────────────────────────
echo ""
echo "Seeding sample curriculum data..."
SEED_STATUS=$(curl -sk -o /dev/null -w "%{http_code}" -X POST "https://localhost:9443/api/v1/admin/seed" 2>/dev/null || echo "000")
if [ "$SEED_STATUS" = "200" ] || [ "$SEED_STATUS" = "201" ]; then
  echo -e "${GREEN}✓ Sample data seeded${RESET}"
else
  echo -e "${YELLOW}⚠ Seed returned HTTP ${SEED_STATUS} — you can seed manually:${RESET}"
  echo "  curl -X POST -k https://localhost:9443/api/v1/admin/seed"
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
