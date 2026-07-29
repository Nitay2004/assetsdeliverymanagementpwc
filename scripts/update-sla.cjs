require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const XLSX = require("xlsx");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set in .env");
  process.exit(1);
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  transactionOptions: { maxWait: 10000, timeout: 30000 },
});

const wb = XLSX.readFile("C:\\Users\\Nitay\\OneDrive - DEV IT SERV\\Desktop\\user format.xlsx");
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

const snKey = "Serial Number";
const slaKey = Object.keys(data[0]).find((k) => k.includes("SLA") && k.includes("Missed"));
const deviceSnKey = Object.keys(data[0]).find((k) => k.includes("Device Serial"));

const map = new Map();
for (const row of data) {
  let sn = String(row[snKey] || "").trim();
  let sla = String(row[slaKey] || "").trim();
  if (!sn || sn === "Cancelled") {
    const deviceSn = String(row[deviceSnKey] || "").trim();
    if (deviceSn) sn = deviceSn;
  }
  if (/^[A-Z0-9]+$/.test(sn) && sn.length >= 5) {
    if (sla === "Met" || sla === "Missed") {
      if (!map.has(sn)) map.set(sn, sla);
    }
  }
}

async function main() {
  const serials = [...map.keys()];
  console.log("Total serials in mapping:", serials.length);

  const items = await prisma.inventoryItem.findMany({
    where: { serialNumber: { in: serials } },
    select: { id: true, serialNumber: true, slaStatus: true },
  });
  console.log("Found in DB:", items.length);

  let toUpdate = 0;
  let alreadyCorrect = 0;
  const updates = [];
  for (const item of items) {
    const expectedSla = map.get(item.serialNumber);
    if (item.slaStatus !== expectedSla) {
      toUpdate++;
      updates.push({ id: item.id, serialNumber: item.serialNumber, current: item.slaStatus, expected: expectedSla });
    } else {
      alreadyCorrect++;
    }
  }
  console.log("Already correct:", alreadyCorrect);
  console.log("Need update:", toUpdate);
  console.log("\nSample updates:");
  updates.slice(0, 10).forEach((u) => console.log(u.serialNumber, "current:", u.current, "->", u.expected));

  if (updates.length > 0) {
    const batchSize = 10;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      let retries = 3;
      while (retries > 0) {
        try {
          await prisma.$transaction(
            batch.map((u) => prisma.inventoryItem.update({ where: { id: u.id }, data: { slaStatus: u.expected } }))
          );
          break;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      if ((Math.floor(i / batchSize) + 1) % 10 === 0) {
        console.log("Updated batch", Math.floor(i / batchSize) + 1, "/", Math.ceil(updates.length / batchSize));
      }
    }
    console.log("\nDone! Updated", updates.length, "items");
  } else {
    console.log("\nNothing to update");
  }
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
