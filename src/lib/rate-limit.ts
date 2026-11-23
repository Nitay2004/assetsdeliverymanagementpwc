import { prisma } from "@/lib/prisma";
import { ensureRuntimeTables } from "@/lib/runtime-tables";

// A fixed-window counter stored in Postgres. Every process/container counts
// against the same row, so raising the replica count no longer multiplies the
// allowed request rate. The window bucket is part of the key, which makes the
// upsert atomic and removes the need for a separate "reset" step.

const RETENTION_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

// Only throttles housekeeping, never the decision itself.
let nextCleanupAt = 0;

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitDecision> {
  await ensureRuntimeTables();

  const now = Date.now();
  const bucketStart = Math.floor(now / windowMs) * windowMs;
  const bucketKey = `${key}:${windowMs}:${bucketStart}`;

  const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `INSERT INTO "rate_limit_counters" ("key", "bucket_start", "count", "updated_at")
     VALUES ($1, $2::bigint, 1, NOW())
     ON CONFLICT ("key") DO UPDATE
       SET "count" = "rate_limit_counters"."count" + 1,
           "updated_at" = NOW()
     RETURNING "count"`,
    bucketKey,
    BigInt(bucketStart),
  );

  if (now >= nextCleanupAt) {
    nextCleanupAt = now + CLEANUP_INTERVAL_MS;
    // Old buckets are useless once they are outside retention; cleanup is
    // best-effort so a permissions problem here cannot reject live traffic.
    await prisma.$executeRaw`DELETE FROM "rate_limit_counters" WHERE "bucket_start" < ${BigInt(now - RETENTION_MS)}::bigint`.catch(() => {});
  }

  const count = Number(rows[0]?.count ?? 0);
  return {
    allowed: count <= maxRequests,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((bucketStart + windowMs - now) / 1000)
    ),
  };
}
