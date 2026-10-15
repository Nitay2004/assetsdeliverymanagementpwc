-- Blanco is performed by the QC engineer who already did the QC, not by the
-- Warehouse team. The warehouse only hands the unit over ("Send for Blanco");
-- these columns record that handover so the engineer's Blanco queue can pick the
-- unit up and so the warehouse can show who it was sent to.
ALTER TABLE "reverse_pickup_requests" ADD COLUMN "blanco_sent_at" TIMESTAMP(3);
ALTER TABLE "reverse_pickup_requests" ADD COLUMN "blanco_sent_by" TEXT;
