-- AlterTable
ALTER TABLE "dockets" ADD COLUMN     "pafex_tracking_found" BOOLEAN,
ADD COLUMN     "courier_tracking_status" TEXT,
ADD COLUMN     "courier_tracking_description" TEXT,
ADD COLUMN     "last_tracking_event_at" TIMESTAMP(3),
ADD COLUMN     "last_tracking_sync_at" TIMESTAMP(3);