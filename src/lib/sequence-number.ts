import { prisma } from "@/lib/prisma";

const SQL_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function assertSqlIdentifier(value: string) {
  if (!SQL_IDENTIFIER.test(value)) {
    throw new Error(`Refusing to build a query for unsafe SQL identifier: ${value}`);
  }
}

/**
 * Highest sequence number currently stored in a prefixed column, plus one.
 *
 * The lookup sorts on the numeric part, never on the raw text. Once a counter
 * outgrows its padding width a lexicographic DESC puts "RPU-9999" above
 * "RPU-11641" (because "9" sorts after "1"), so a text sort keeps handing back
 * a number that is already taken and every insert collides on the unique
 * column.
 *
 * `valuePattern` must contain exactly one capturing group around the sequence,
 * e.g. /^RPU-([0-9]+)$/ for RPU-0001 or /^DC-PDH-([0-9]+)-\d{2}-\d{2}$/ for
 * DC-PDH-0001-26-27. It is applied in Postgres to filter and to sort.
 */
export async function nextSequenceNumber(options: {
  table: string;
  column: string;
  valuePattern: RegExp;
}): Promise<number> {
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