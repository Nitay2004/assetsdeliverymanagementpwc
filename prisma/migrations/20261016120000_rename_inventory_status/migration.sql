-- Rename the inventory lifecycle statuses to the business names used in the
-- provisioning file ("Master Provision Status-1 NEW").
--
--   NEW       -> PROVISION_PENDING          (Provision Pending - Asset in Warehouse)
--   ALLOCATED -> ASSET_REDEPLOYED           (Asset Redeployed)
--   AVAILABLE -> ASSET_RETURN_TO_WAREHOUSE  (Asset Return to Warehouse)
--
-- The label SHIPPED_TO_USER (first deployment to a user) is new; existing
-- ALLOCATED rows are split into SHIPPED_TO_USER / ASSET_REDEPLOYED in the next
-- migration because a value added with ALTER TYPE cannot be used in the same
-- transaction.
ALTER TYPE "InventoryStatus" RENAME VALUE 'NEW' TO 'PROVISION_PENDING';
ALTER TYPE "InventoryStatus" RENAME VALUE 'ALLOCATED' TO 'ASSET_REDEPLOYED';
ALTER TYPE "InventoryStatus" RENAME VALUE 'AVAILABLE' TO 'ASSET_RETURN_TO_WAREHOUSE';
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'SHIPPED_TO_USER';

ALTER TABLE "inventory_items"
  ALTER COLUMN "status" SET DEFAULT 'ASSET_RETURN_TO_WAREHOUSE';
