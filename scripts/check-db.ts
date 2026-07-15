import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const item = await prisma.inventoryItem.findFirst({ orderBy: { createdAt: "desc" } });
  if (!item) { console.log("No items found"); return; }
  
  // Show all non-null fields
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (v !== null && k !== "id" && k !== "createdAt" && k !== "updatedAt") {
      fields[k] = v;
    }
  }
  console.log("=== Non-null fields ===");
  console.log(JSON.stringify(fields, null, 2));
  
  // Count total items
  const count = await prisma.inventoryItem.count();
  console.log(`\nTotal items: ${count}`);
  
  // Count items with specific fields populated
  const withEmployee = await prisma.inventoryItem.count({ where: { employeeName: { not: null } } });
  const withTracking = await prisma.inventoryItem.count({ where: { trackingStatus: { not: null } } });
  const withSlaState = await prisma.inventoryItem.count({ where: { slaState: { not: null } } });
  const withSlaStatus = await prisma.inventoryItem.count({ where: { slaStatus: { not: null } } });
  const withCheckField = await prisma.inventoryItem.count({ where: { checkField: { not: null } } });
  const withCsvStatus = await prisma.inventoryItem.count({ where: { csvStatus: { not: null } } });
  const withSlaStartDate = await prisma.inventoryItem.count({ where: { slaStartDate: { not: null } } });
  const withWarrantyEndPeriod = await prisma.inventoryItem.count({ where: { warrantyEndPeriod: { not: null } } });
  const withLaptopAcceptanceDate = await prisma.inventoryItem.count({ where: { laptopAcceptanceDate: { not: null } } });
  const withCutOffStatus = await prisma.inventoryItem.count({ where: { cutOffStatus: { not: null } } });
  const withZon = await prisma.inventoryItem.count({ where: { zone: { not: null } } });
  const withPartNo = await prisma.inventoryItem.count({ where: { partNo: { not: null } } });
  const withBoxSerialNo = await prisma.inventoryItem.count({ where: { boxSerialNo: { not: null } } });
  const withInvoiceProductDesc = await prisma.inventoryItem.count({ where: { invoiceProductDescription: { not: null } } });
  const withDeliveryDate = await prisma.inventoryItem.count({ where: { deliveryDate: { not: null } } });
  const withDocketNumber = await prisma.inventoryItem.count({ where: { docketNumber: { not: null } } });
  const withVendor = await prisma.inventoryItem.count({ where: { vendor: { not: null } } });
  
  console.log("\n=== Field population ===");
  console.log(`employeeName: ${withEmployee}`);
  console.log(`trackingStatus: ${withTracking}`);
  console.log(`slaState: ${withSlaState}`);
  console.log(`slaStatus: ${withSlaStatus}`);
  console.log(`checkField: ${withCheckField}`);
  console.log(`csvStatus: ${withCsvStatus}`);
  console.log(`slaStartDate: ${withSlaStartDate}`);
  console.log(`warrantyEndPeriod: ${withWarrantyEndPeriod}`);
  console.log(`laptopAcceptanceDate: ${withLaptopAcceptanceDate}`);
  console.log(`cutOffStatus: ${withCutOffStatus}`);
  console.log(`zone: ${withZon}`);
  console.log(`partNo: ${withPartNo}`);
  console.log(`boxSerialNo: ${withBoxSerialNo}`);
  console.log(`invoiceProductDescription: ${withInvoiceProductDesc}`);
  console.log(`deliveryDate: ${withDeliveryDate}`);
  console.log(`docketNumber: ${withDocketNumber}`);
  console.log(`vendor: ${withVendor}`);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
