import { Prisma } from "@prisma/client";

/**
 * Retries `fn` when it fails with a Prisma P2002 unique-constraint violation.
 *
 * Sequence numbers themselves are now allocated atomically by
 * `lib/sequence-number.ts`, so P2002 on the number column should not happen.
 * This helper is kept for the other unique constraints around a document create
 * (for example "one DC per order") and for the status-claim update: a stale tab
 * can lose that race, and re-running the callback re-checks the preconditions.
 *
 * The callback owns the whole operation (allocate a fresh number, check state,
 * write), so a retry starts from a clean snapshot.
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
