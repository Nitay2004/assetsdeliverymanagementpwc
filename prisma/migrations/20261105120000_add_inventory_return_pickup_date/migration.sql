-- Day the unit came back inward to the warehouse (Warehouse → Reverse →
-- "Receive at Warehouse"). Existing rows stay NULL: no backfill.

-- AlterTable
ALTER TABLE "inventory_items"
ADD COLUMN "return_pickup_date" DATE;
