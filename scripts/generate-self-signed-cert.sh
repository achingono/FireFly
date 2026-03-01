#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../infra/nginx/certs" && pwd)"
KEY_FILE="$CERT_DIR/localhost.key"
CRT_FILE="$CERT_DIR/localhost.crt"

mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CRT_FILE" \
  -subj "/C=US/ST=Local/L=Local/O=FireFly/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Generated: $CRT_FILE"
echo "Generated: $KEY_FILE"
