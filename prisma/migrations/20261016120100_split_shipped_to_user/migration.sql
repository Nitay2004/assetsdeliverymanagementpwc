-- Split the (renamed) ASSET_REDEPLOYED bucket: an asset whose provisioning
-- status says it was shipped to a user for the first time is SHIPPED_TO_USER,
-- everything else stays ASSET_REDEPLOYED.
UPDATE "inventory_items"
SET "status" = 'SHIPPED_TO_USER'
WHERE "status" = 'ASSET_REDEPLOYED'
  AND "process_status" ILIKE '%shipped to the user%';
