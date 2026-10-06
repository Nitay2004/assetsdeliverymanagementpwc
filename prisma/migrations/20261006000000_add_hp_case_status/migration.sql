-- QC that used to fail left the request with nowhere to go: Blancco Clear
-- refuses to run until both QC stages pass, so the asset stalled at QC with no
-- record of why. Logging a case with HP gives that outcome a status of its own,
-- and the new columns carry who raised the case, when, and who later cleared it.

-- AlterEnum
ALTER TYPE "ReversePickupStatus" ADD VALUE IF NOT EXISTS 'CASE_LOGGED_WITH_HP';

-- AlterTable
ALTER TABLE "reverse_pickup_requests" ADD COLUMN     "hp_case_logged_at" DATE,
ADD COLUMN     "hp_case_logged_by" TEXT,
ADD COLUMN     "hp_case_number" TEXT,
ADD COLUMN     "hp_case_remarks" TEXT,
ADD COLUMN     "hp_case_resolved_at" DATE,
ADD COLUMN     "hp_case_resolved_by" TEXT,
ADD COLUMN     "hp_case_resolved_remarks" TEXT;
