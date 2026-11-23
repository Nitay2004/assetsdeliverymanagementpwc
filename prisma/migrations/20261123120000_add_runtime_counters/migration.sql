-- Shared counters used by the app itself. CI does not run migrations on deploy,
-- so src/lib/runtime-tables.ts also creates these idempotently on first use.
-- CREATE ... IF NOT EXISTS keeps this migration safe if that already happened.

CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
  "key" TEXT NOT NULL,
  "bucket_start" BIGINT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "rate_limit_counters_bucket_start_idx"
  ON "rate_limit_counters" ("bucket_start");

CREATE TABLE IF NOT EXISTS "sequence_counters" (
  "key" TEXT NOT NULL,
  "next_value" BIGINT NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "sequence_counters_pkey" PRIMARY KEY ("key")
);
