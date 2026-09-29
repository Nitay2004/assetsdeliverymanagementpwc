import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// The database is reached through a session-mode pooler whose whole backend pool
// is capped (pool_size: 15) and shared by everything on the host, so this pool
// stays deliberately small. The pool must also be created only once per process:
// building it at module scope while caching only the client leaks a fresh set of
// connections on every hot reload until the pooler rejects new clients with
// EMAXCONNSESSION.
function createPrismaClient() {
  const pool = new Pool({
    connectionString: `${process.env.DATABASE_URL}`,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
