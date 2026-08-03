import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const r = await prisma.inventoryItem.update({
    where: { id: "e46b621c-3117-4ce4-a1a7-2a257b74e137" },
    data: { status: "QC_PENDING", qcRequestedAt: new Date() },
  });
  console.log("Updated:", r.status, r.serialNumber);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
