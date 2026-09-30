-- POD document (proof of delivery) for reverse pickup requests.

-- AlterTable
ALTER TABLE "reverse_pickup_requests"
ADD COLUMN "pod_document_url" TEXT;