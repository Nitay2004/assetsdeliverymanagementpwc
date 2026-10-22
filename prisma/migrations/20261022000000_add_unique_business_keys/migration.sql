-- Business keys that must be unique.
--
-- These are enforced in the database, not only by a read-then-write check in
-- application code, so two concurrent requests can no longer persist the same
-- statutory number or put one physical item into two live orders.
CREATE UNIQUE INDEX "dockets_docket_number_key"
  ON "dockets" ("docket_number");
CREATE UNIQUE INDEX "dockets_eway_bill_number_key"
  ON "dockets" ("eway_bill_number");
CREATE UNIQUE INDEX "reverse_pickup_requests_e_way_bill_no_key"
  ON "reverse_pickup_requests" ("e_way_bill_no");

-- One inventory item may appear at most once in the same order.
CREATE UNIQUE INDEX "assets_order_id_inventory_item_id_key"
  ON "assets" ("order_id", "inventory_item_id");

-- A physical item can only be linked to one non-released asset row at a time.
-- Historical rows are kept (status = 'released' when the order reaches a
-- terminal state), so redeployment to a new order remains possible.
CREATE UNIQUE INDEX "assets_inventory_item_id_active_key"
  ON "assets" ("inventory_item_id")
  WHERE "inventory_item_id" IS NOT NULL AND "status" <> 'released';
