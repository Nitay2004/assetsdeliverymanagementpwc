import { prisma } from "@/lib/prisma";
import { ensureRuntimeTables } from "@/lib/runtime-tables";

// Postgres folds unquoted identifiers to lower case, so mixed-case columns only
// work because every identifier here is double-quoted. Both cases are therefore
// legitimate: "requestNumber" and "dc_number" are real columns in this schema.
const SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertSqlIdentifier(value: string) {
  if (!SQL_IDENTIFIER.test(value)) {
    throw new Error(`Refusing to build a query for unsafe SQL identifier: ${value}`);
  }
}

export interface SequenceOptions {
  table: string;
  column: string;
  /** Exactly one capturing group around the numeric part. */
  valuePattern: RegExp;
}

/**
 * Highest sequence number currently stored in a prefixed column, plus one.
 *
 * The lookup sorts on the numeric part, never on the raw text. Once a counter
 * outgrows its padding width a lexicographic DESC puts "RPU-9999" above
 * "RPU-11641" (because "9" sorts after "1"), so a text sort keeps handing back
 * a number that is already taken and every insert collides on the unique
 * column.
 */
async function deriveNextFromData(options: SequenceOptions): Promise<number> {
  const { table, column } = options;
  assertSqlIdentifier(table);
  assertSqlIdentifier(column);

  // The regex travels as a bound parameter ($1) and may be referenced by every
  // clause; only the validated identifiers are interpolated.
  const rows = await prisma.$queryRawUnsafe<{ seq: string | null }[]>(
    `SELECT substring("${column}" from $1) AS seq
       FROM "${table}"
      WHERE "${column}" ~ $1
      ORDER BY substring("${column}" from $1)::bigint DESC
      LIMIT 1`,
    options.valuePattern.source,
  );

  const current = Number(rows[0]?.seq);
  return Number.isFinite(current) && current > 0 ? current + 1 : 1;
}

// Include the pattern in the key so a new financial year gets its own DC series
// instead of inheriting the previous year's counter.
function counterKey(options: SequenceOptions): string {
  return `sequence:${options.table}:${options.column}:${options.valuePattern.source}`;
}

/**
 * Reserves `count` consecutive numbers for one caller.
 *
 * The old code did SELECT max+1 in every caller and inserted afterwards, so two
 * concurrent requests could derive the same value and one of them died with a
 * P2002. Here the allocation is a single atomic Postgres upsert on a durable
 * counter row. Two callers — in this process or another container — can never
 * receive the same number. GREATEST() also keeps the counter ahead of any rows
 * inserted outside the app.
 */
export async function allocateSequenceNumbers(
  options: SequenceOptions,
  count: number
): Promise<{ start: number; end: number }> {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("allocateSequenceNumbers requires a positive integer count");
  }

  await ensureRuntimeTables();
  const derivedNext = await deriveNextFromData(options);

  const rows = await prisma.$queryRawUnsafe<{ start: bigint | string | number }[]>(
    `INSERT INTO "sequence_counters" ("key", "next_value", "updated_at")
     VALUES ($1, $2::bigint + $3::bigint, NOW())
     ON CONFLICT ("key") DO UPDATE
       SET "next_value" = GREATEST("sequence_counters"."next_value", $2::bigint) + $3::bigint,
           "updated_at" = NOW()
     RETURNING "next_value" - $3::bigint AS start`,
    counterKey(options),
    BigInt(derivedNext),
    BigInt(count),
  );

  const start = Number(rows[0]?.start ?? derivedNext);
  if (!Number.isFinite(start) || start < 1) {
    throw new Error(`Invalid sequence number allocated for ${counterKey(options)}`);
  }
  return { start, end: start + count - 1 };
}

/** Reserves a single number. Kept for the many single-row call sites. */
export async function nextSequenceNumber(options: SequenceOptions): Promise<number> {
  const { start } = await allocateSequenceNumbers(options, 1);
  return start;
}
