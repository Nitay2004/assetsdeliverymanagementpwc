-- Performance indexes for the inventory table:
--   * status                    -> fast status filtering / grouping (dashboard counts, table filters)
--   * invoicing_warehouse       -> fast warehouse grouping (dashboard stock-by-warehouse)
--   * tracking_status / tracking_sub_status (trigram GIN) -> fast ILIKE '%...%' searches
--     (dashboard in-transit / delivered / RTO counts). pg_trgm is a trusted
--     extension, so the DB/table owner can enable it without superuser.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE INDEX IF NOT EXISTS "inventory_items_status_idx"
  ON "inventory_items" ("status");

CREATE INDEX IF NOT EXISTS "inventory_items_invoicing_warehouse_idx"
  ON "inventory_items" ("invoicing_warehouse");

CREATE INDEX IF NOT EXISTS "inventory_items_trgm_tracking_status_idx"
  ON "inventory_items" USING GIN ("tracking_status" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "inventory_items_trgm_tracking_sub_status_idx"
  ON "inventory_items" USING GIN ("tracking_sub_status" gin_trgm_ops);