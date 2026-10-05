-- Pafex uploads the POD image after the delivery scan, so a docket can be
-- delivered before its document exists. This records that the document was
-- asked for, which lets the sync make exactly one further attempt and then
-- stop bothering, rather than either never retrying or retrying forever.
ALTER TABLE "inventory_items" ADD COLUMN "pod_attempted_at" TIMESTAMP(3);