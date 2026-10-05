-- Proof of delivery per serial number. The Pafex sync fills this when the courier
-- reports the docket delivered, and the inventory drawer opens it from here.
ALTER TABLE "inventory_items" ADD COLUMN "pod_document_url" TEXT;