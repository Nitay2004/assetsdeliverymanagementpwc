import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== Inventory items with QC involvement or user details ===");
  const items = await prisma.inventoryItem.findMany({
    where: {
      OR: [
        { status: { in: ["QC_PENDING", "DEFECTIVE", "ALLOCATED", "AVAILABLE"] } },
        { qcFinalResult: { not: null } },
        { employeeName: { not: null } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  for (const it of items) {
    console.log("--------------------------------");
    console.log(`id: ${it.id}`);
    console.log(`serialNo: ${it.serialNo ?? "-"}`);
    console.log(`model: ${it.model ?? "-"}`);
    console.log(`status: ${it.status}`);
    console.log(`trackingStatus: ${it.trackingStatus ?? "-"}`);
    console.log(`employeeName: ${it.employeeName ?? "-"}`);
    console.log(`entity: ${it.entity ?? "-"}`);
    console.log(`qcRequestedAt: ${it.qcRequestedAt ?? "-"}`);
    console.log(`qcCleanResult: ${it.qcCleanResult ?? "-"}`);
    console.log(`qcPurgeResult: ${it.qcPurgeResult ?? "-"}`);
    console.log(`qcFinalResult: ${it.qcFinalResult ?? "-"}`);
    console.log(`qcCompletedAt: ${it.qcCompletedAt ?? "-"}`);
    console.log(`qcRemarks: ${it.qcRemarks ?? "-"}`);
    console.log(`updatedAt: ${it.updatedAt}`);
  }

  console.log("\n=== Orders (most recent 15) ===");
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { assets: true },
  });
  for (const o of orders) {
    console.log("--------------------------------");
    console.log(`id: ${o.id}`);
    console.log(`orderNumber: ${o.orderNumber ?? "-"}`);
    console.log(`clientName: ${o.clientName ?? "-"}`);
    console.log(`status: ${o.status}`);
    console.log(`trackingStatus: ${o.trackingStatus ?? "-"}`);
    console.log(`intermediary: ${o.intermediary ?? "-"}`);
    console.log(`assets: ${o.assets.map(a => `${a.serialNo ?? a.id}`).join(", ")}`);
  }

  console.log("\n=== Assets linked to inventory (most recent 15) ===");
  const assets = await prisma.asset.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  for (const a of assets) {
    console.log("--------------------------------");
    console.log(`id: ${a.id}`);
    console.log(`assetTag: ${a.assetTag ?? "-"}`);
    console.log(`serialNo: ${a.serialNo ?? "-"}`);
    console.log(`status: ${a.status}`);
    console.log(`inventoryItemId: ${a.inventoryItemId ?? "-"}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
