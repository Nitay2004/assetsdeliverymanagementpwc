-- Expected delivery date, captured at user assignment time.

-- AlterTable
ALTER TABLE "inventory_items"
ADD COLUMN "expected_delivery_date" DATE;
