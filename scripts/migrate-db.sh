#!/usr/bin/env bash
# One-time data migration: Supabase (old) -> STAG-DB1 (new)
# Run on STAG-APP1 (10.199.206.100) AFTER postgres is up on STAG-DB1
# (the new DB must be EMPTY - no schema yet).
set -euo pipefail

set -a
source "$(dirname "$0")/supabase-old.env"
source "$(dirname "$0")/../.env"
set +a

NEW_URL="${DIRECT_URL:-${DATABASE_URL}}"
DUMP_FILE=/tmp/supabase-dump.sql

# The app image runs as USER nextjs; pass --user root so apk can install the client.
# -e forwards the OLD_* vars into the container for the dump.
RUN="docker compose run --rm --no-deps --user root -e OLD_HOST -e OLD_PORT -e OLD_USER -e OLD_DB -e OLD_PASSWORD --entrypoint /bin/sh app -c"

echo ">> Dumping schema + data from Supabase (via IPv4 pooler)..."
$RUN "apk add --no-cache postgresql-client >/dev/null 2>&1 && PGPASSWORD=\"\$OLD_PASSWORD\" pg_dump -h \"\$OLD_HOST\" -p \"\$OLD_PORT\" -U \"\$OLD_USER\" -d \"\$OLD_DB\" --schema=public --no-owner --no-acl" \
  | grep -v 'ENABLE ROW LEVEL SECURITY' | grep -v 'CREATE POLICY' | grep -v '^CREATE SCHEMA public;' | grep -v '^SET transaction_timeout' > "$DUMP_FILE"
echo ">> Dump saved to $DUMP_FILE ($(wc -l < "$DUMP_FILE") lines)"

echo ">> Restoring into new DB (STAG-DB1)..."
$RUN "apk add --no-cache postgresql-client >/dev/null 2>&1 && psql \"$NEW_URL\" -q -v ON_ERROR_STOP=1" < "$DUMP_FILE"

echo ">> Verify row counts on new DB:"
$RUN "apk add --no-cache postgresql-client >/dev/null 2>&1 && psql \"$NEW_URL\" -c \"SELECT 'users' t, count(*) FROM public.users UNION ALL SELECT 'inventory_items', count(*) FROM public.inventory_items UNION ALL SELECT 'assignment_records', count(*) FROM public.assignment_records UNION ALL SELECT 'reverse_pickup_requests', count(*) FROM public.reverse_pickup_requests;\"" 

echo ">> Done. Now delete scripts/supabase-old.env"
