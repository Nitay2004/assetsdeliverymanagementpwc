ALTER TABLE "delivery_challan_items" ADD COLUMN     "cgst_amount" DECIMAL(12,2),
ADD COLUMN     "cgst_rate" DECIMAL(5,2),
ADD COLUMN     "sgst_amount" DECIMAL(12,2),
ADD COLUMN     "sgst_rate" DECIMAL(5,2);
ALTER TABLE "delivery_challans" ADD COLUMN     "cgst" DECIMAL(12,2),
ADD COLUMN     "sgst" DECIMAL(12,2);
