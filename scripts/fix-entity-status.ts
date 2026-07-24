/**
 * One-time migration: Change status from AVAILABLE to NEW for inventory items
 * where entity is empty/null.
 *
 * Run: npx tsx scripts/fix-entity-status.ts
 */

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.inventoryItem.updateMany({
    where: {
      status: "AVAILABLE",
      OR: [
        { entity: null },
        { entity: "" },
      ],
    },
    data: {
      status: "NEW",
    },
  });

  console.log(`Updated ${result.count} items: AVAILABLE -> NEW (entity empty)`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
