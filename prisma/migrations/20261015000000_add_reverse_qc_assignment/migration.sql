-- Reverse QC is no longer recorded inline by the Warehouse team. Instead the
-- warehouse receives the unit and assigns a QC engineer, and the engineer records
-- the hardware / software QC from their own "my tasks" queue. These columns hold
-- that assignment; the existing qc_clean_* / qc_purge_* columns keep the results.
ALTER TABLE "reverse_pickup_requests" ADD COLUMN "qc_engineer" TEXT;
ALTER TABLE "reverse_pickup_requests" ADD COLUMN "qc_assigned_at" TIMESTAMP(3);
ALTER TABLE "reverse_pickup_requests" ADD COLUMN "qc_location" TEXT;

CREATE INDEX "reverse_pickup_requests_qc_engineer_idx" ON "reverse_pickup_requests"("qc_engineer");
