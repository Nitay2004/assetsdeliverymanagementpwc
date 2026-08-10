#!/usr/bin/env bash
# Non-intrusive: runs PostgreSQL in its OWN docker container on port 5433.
# Does NOT touch the system PostgreSQL or any existing database/apps.
# Run on STAG-DB1 (10.199.206.99) as root.
set -euo pipefail

DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-assetdelivery}"
DB_PASS="${DB_PASS:-assetdelivery}"
DB_NAME="${DB_NAME:-assetdelivery}"

# Docker install ONLY if not already present (won't disturb existing install)
if ! command -v docker >/dev/null 2>&1; then
  echo ">> Docker not found, installing..."

  # Ensure a download tool exists (curl or wget)
  if command -v curl >/dev/null 2>&1; then
    DOWNLOAD="curl -fsSL"
  elif command -v wget >/dev/null 2>&1; then
    DOWNLOAD="wget -qO-"
  else
    echo ">> Installing curl..."
    (apt-get update && apt-get install -y curl) >/dev/null 2>&1
    DOWNLOAD="curl -fsSL"
  fi

  $DOWNLOAD https://get.docker.com | sh
fi

# Start our own postgres container if not already running
if ! docker inspect asset-delivery-db >/dev/null 2>&1; then
  echo ">> Creating postgres container (port ${DB_PORT})..."
  docker run -d \
    --name asset-delivery-db \
    --restart unless-stopped \
    -p "${DB_PORT}:5432" \
    -e POSTGRES_USER="${DB_USER}" \
    -e POSTGRES_PASSWORD="${DB_PASS}" \
    -e POSTGRES_DB="${DB_NAME}" \
    -v asset-delivery-db-data:/var/lib/postgresql/data \
    postgres:16-alpine
else
  echo ">> asset-delivery-db container already exists, skipping."
fi

echo ">> Waiting for postgres to be ready..."
for i in $(seq 1 30); do
  if docker exec asset-delivery-db pg_isready -U "${DB_USER}" >/dev/null 2>&1; then
    echo ">> PostgreSQL ready on 10.199.206.99:${DB_PORT} (user=${DB_USER} db=${DB_NAME})"
    exit 0
  fi
  sleep 2
done
echo ">> ERROR: postgres did not become ready" >&2
exit 1
