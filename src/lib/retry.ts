import { Prisma } from "@prisma/client";

/**
 * Retries `fn` when it fails with a Prisma P2002 unique-constraint violation.
 *
 * Read-then-write sequence numbers (DC numbers, reverse-pickup request numbers)
 * collide when two callers derive the same value in the same instant: both
 * `SELECT max(...)` the same row, both compute `+1`, and the second insert dies
 * on the unique column. Re-deriving inside a short retry loop is simpler than
 * serialising every caller with an advisory lock, and it is the pattern this
 * codebase already uses in `reverse-pickup.ts`.
 *
 * The callback owns the whole re-derivation (fetch a fresh number, then write),
 * so a retry sees a value no other caller has claimed yet.
 */
export async function withUniqueRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isUniqueViolation =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isUniqueViolation || attempt === attempts - 1) throw error;
      // Not the last attempt: fall through and re-run the callback, which
      // re-reads the sequence and produces a number nobody else holds.
    }
  }
  // Unreachable: the loop returns on success or throws on the final attempt.
  throw new Error("withUniqueRetry exhausted without producing a value");
}
