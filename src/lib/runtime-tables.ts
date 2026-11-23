import { prisma } from "@/lib/prisma";

// CI deploys code without running `prisma migrate deploy`, so a brand-new table
// would not exist on the server until someone migrated it by hand. These two
// small tables are infrastructure for the app itself (rate limiting and atomic
// sequence allocation), so they are bootstrapped idempotently on first use.
// A matching migration is committed as well; when it has already been applied,
// the checks below are read-only and no CREATE privilege is needed.

const BOOTSTRAP_LOCK_KEY = "ads:runtime-tables:20261123";

const TABLES = {
  rate_limit_counters: `CREATE TABLE "rate_limit_counters" (
    "key" TEXT NOT NULL,
    "bucket_start" BIGINT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
  )`,
  sequence_counters: `CREATE TABLE "sequence_counters" (
    "key" TEXT NOT NULL,
    "next_value" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "sequence_counters_pkey" PRIMARY KEY ("key")
  )`,
} as const;

const INDEXES = {
  rate_limit_counters_bucket_start_idx:
    'CREATE INDEX "rate_limit_counters_bucket_start_idx" ON "rate_limit_counters" ("bucket_start")',
} as const;

let bootstrap: Promise<void> | null = null;

async function createMissingObjects(): Promise<void> {
  await prisma.$transaction(async tx => {
    // Serialise first-time creation across processes/containers.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${BOOTSTRAP_LOCK_KEY}::text)::bigint)`;

    for (const [table, ddl] of Object.entries(TABLES)) {
      const rows = await tx.$queryRawUnsafe<{ exists: boolean }[]>(
        "SELECT to_regclass($1) IS NOT NULL AS exists",
        table,
      );
      if (!rows[0]?.exists) await tx.$executeRawUnsafe(ddl);
    }

    for (const [index, ddl] of Object.entries(INDEXES)) {
      const rows = await tx.$queryRawUnsafe<{ exists: boolean }[]>(
        "SELECT to_regclass($1) IS NOT NULL AS exists",
        index,
      );
      if (!rows[0]?.exists) await tx.$executeRawUnsafe(ddl);
    }
  }, { timeout: 30_000 });
}

export function ensureRuntimeTables(): Promise<void> {
  if (!bootstrap) {
    bootstrap = createMissingObjects().catch(error => {
      // Allow a later request to retry if the first attempt failed (e.g. DB was
      // briefly unavailable during deploy).
      bootstrap = null;
      throw error;
    });
  }
  return bootstrap;
}
