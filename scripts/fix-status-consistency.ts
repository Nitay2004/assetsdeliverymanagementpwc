import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.inventoryItem.updateMany({
    where: {
      status: "AVAILABLE",
      OR: [
        { trackingStatus: { contains: "Delivered", mode: "insensitive" } },
        { trackingStatus: { contains: "Dispatched", mode: "insensitive" } },
        { trackingStatus: { contains: "Invoiced", mode: "insensitive" } },
        { trackingStatus: { contains: "Payment", mode: "insensitive" } },
        { trackingStatus: { contains: "Confirmed", mode: "insensitive" } },
        { trackingStatus: { contains: "Warranty", mode: "insensitive" } },
      ],
    },
    data: { status: "ALLOCATED" },
  });

  console.log(`Fixed ${result.count} items.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
