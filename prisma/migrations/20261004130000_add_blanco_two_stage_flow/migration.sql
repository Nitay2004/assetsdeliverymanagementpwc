-- Reverse pickup QC runs in two stages: hardware QC then software QC.
-- Blancco runs in two stages of its own: Clear then Purge, with the Blancco
-- certificate uploaded at the end of the purge stage.

-- AlterEnum
ALTER TYPE "ReversePickupStatus" ADD VALUE IF NOT EXISTS 'BLANCO_CLEARED';
ALTER TYPE "ReversePickupStatus" ADD VALUE IF NOT EXISTS 'BLANCO_PURGED';

-- AlterTable
ALTER TABLE "reverse_pickup_requests"
ADD COLUMN "blanco_clear_result" TEXT,
ADD COLUMN "blanco_clear_remarks" TEXT,
ADD COLUMN "blanco_clear_date" DATE,
ADD COLUMN "blanco_clear_by" TEXT,
ADD COLUMN "blanco_purge_result" TEXT,
ADD COLUMN "blanco_purge_remarks" TEXT,
ADD COLUMN "blanco_purge_date" DATE,
ADD COLUMN "blanco_purge_by" TEXT;
