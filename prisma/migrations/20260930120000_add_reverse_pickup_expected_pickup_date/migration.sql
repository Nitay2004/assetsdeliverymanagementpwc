-- Expected pickup date for reverse pickup requests: derived from SLA start date
-- + derived TAT, so SLA Met/Missed can be judged against the pickup date.

-- AlterTable
ALTER TABLE "reverse_pickup_requests"
ADD COLUMN "expected_pickup_date" DATE;

-- Index
CREATE INDEX "reverse_pickup_requests_expected_pickup_date_idx" ON "reverse_pickup_requests"("expected_pickup_date");

-- Index
CREATE INDEX "reverse_pickup_requests_sla_idx" ON "reverse_pickup_requests"("sla");