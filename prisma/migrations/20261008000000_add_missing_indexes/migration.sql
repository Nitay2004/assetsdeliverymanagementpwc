-- Indexes for the hot filter/sort columns identified in the 2026-10-08 audit.
-- IF NOT EXISTS keeps the migration idempotent: the DB may have been patched
-- directly during the audit, and `migrate deploy` must succeed either way.

-- Orders: status filters on every dashboard + createdAt/updatedAt sorts
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders"("created_at");
CREATE INDEX IF NOT EXISTS "orders_updated_at_idx" ON "orders"("updated_at");

-- Assets: relation filters from provisioning/dc/warehouse/assignment actions
CREATE INDEX IF NOT EXISTS "assets_order_id_idx" ON "assets"("order_id");
CREATE INDEX IF NOT EXISTS "assets_inventory_item_id_idx" ON "assets"("inventory_item_id");

-- InventoryItem: employee lookups (assignment history, QC, imports)
CREATE INDEX IF NOT EXISTS "inventory_items_employee_name_idx" ON "inventory_items"("employee_name");

-- ReversePickupRequest: status pipelines + column-filter/search keys
CREATE INDEX IF NOT EXISTS "reverse_pickup_requests_status_idx" ON "reverse_pickup_requests"("status");
CREATE INDEX IF NOT EXISTS "reverse_pickup_requests_serial_number_idx" ON "reverse_pickup_requests"("serial_number");
CREATE INDEX IF NOT EXISTS "reverse_pickup_requests_docket_number_idx" ON "reverse_pickup_requests"("docket_number");
CREATE INDEX IF NOT EXISTS "reverse_pickup_requests_employee_name_idx" ON "reverse_pickup_requests"("employee_name");

-- Dockets: order relation joins + docket/e-way lookups (Pafex sync, search)
CREATE INDEX IF NOT EXISTS "dockets_order_id_idx" ON "dockets"("order_id");
CREATE INDEX IF NOT EXISTS "dockets_docket_number_idx" ON "dockets"("docket_number");
CREATE INDEX IF NOT EXISTS "dockets_eway_bill_number_idx" ON "dockets"("eway_bill_number");

-- DeliveryChallan: order / reverse-pickup relation joins (finance, exports)
CREATE INDEX IF NOT EXISTS "delivery_challans_order_id_idx" ON "delivery_challans"("order_id");
CREATE INDEX IF NOT EXISTS "delivery_challans_reverse_pickup_request_id_idx" ON "delivery_challans"("reverse_pickup_request_id");
