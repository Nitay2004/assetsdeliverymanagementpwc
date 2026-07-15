import "dotenv/config";
import { Pool } from "pg";

async function main() {
  console.log("Connecting to database...");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  console.log("Connected!");
  try {
    // Fix 1: Items with employee name but AVAILABLE
    const r1 = await client.query(
      "UPDATE inventory_items SET status = 'ALLOCATED' WHERE status = 'AVAILABLE' AND employee_name IS NOT NULL"
    );
    console.log("Fixed " + r1.rowCount + " items with employeeName but AVAILABLE status.");

    // Fix 2: Items with tracking status but AVAILABLE
    const r2 = await client.query(
      "UPDATE inventory_items SET status = 'ALLOCATED' WHERE status = 'AVAILABLE' AND tracking_status IS NOT NULL AND tracking_status != ''"
    );
    console.log("Fixed " + r2.rowCount + " items with tracking status but AVAILABLE status.");

    // Fix 3: Items linked to allocated assets
    const r3 = await client.query(
      "UPDATE inventory_items SET status = 'ALLOCATED' WHERE status = 'AVAILABLE' AND id IN (SELECT inventory_item_id FROM assets WHERE status = 'allocated' AND inventory_item_id IS NOT NULL)"
    );
    console.log("Fixed " + r3.rowCount + " items linked to allocated assets but AVAILABLE status.");

    const total = (r1.rowCount || 0) + (r2.rowCount || 0) + (r3.rowCount || 0);
    console.log("\nTotal items fixed: " + total);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(function(e) { console.error("ERROR:", e.message); process.exit(1); });
