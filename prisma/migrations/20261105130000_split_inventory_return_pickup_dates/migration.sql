-- `return_pickup_date` was introduced as the warehouse-received date. It now
-- means the day the reverse pickup request was raised, so the dates already
-- captured move to the dedicated `asset_received_date` column instead of being
-- lost or reinterpreted.

-- AlterTable
ALTER TABLE "inventory_items" RENAME COLUMN "return_pickup_date" TO "asset_received_date";

-- AlterTable
ALTER TABLE "inventory_items"
ADD COLUMN "return_pickup_date" DATE;
