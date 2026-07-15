import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Fix 1: Items with employee name assigned but status still AVAILABLE
  const r1 = await prisma.inventoryItem.updateMany({
    where: {
      status: "AVAILABLE",
      employeeName: { not: null },
    },
    data: { status: "ALLOCATED" },
  });
  console.log(`Fixed ${r1.count} items with employeeName but AVAILABLE status.`);

  // Fix 2: Items with delivered-like tracking status but still AVAILABLE
  const r2 = await prisma.inventoryItem.updateMany({
    where: {
      status: "AVAILABLE",
      OR: [
        { trackingStatus: { contains: "Delivered", mode: "insensitive" } },
        { trackingStatus: { contains: "Dispatched", mode: "insensitive" } },
        { trackingStatus: { contains: "Invoiced", mode: "insensitive" } },
        { trackingStatus: { contains: "Payment", mode: "insensitive" } },
        { trackingStatus: { contains: "Confirmed", mode: "insensitive" } },
        { trackingStatus: { contains: "Warranty", mode: "insensitive" } },
        { trackingStatus: { contains: "Allocated", mode: "insensitive" } },
      ],
    },
    data: { status: "ALLOCATED" },
  });
  console.log(`Fixed ${r2.count} items with tracking status but AVAILABLE status.`);

  // Fix 3: Items linked to assets (orders) but still AVAILABLE
  const r3 = await prisma.inventoryItem.updateMany({
    where: {
      status: "AVAILABLE",
      assets: { some: { status: "allocated" } },
    },
    data: { status: "ALLOCATED" },
  });
  console.log(`Fixed ${r3.count} items linked to allocated assets but AVAILABLE status.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
