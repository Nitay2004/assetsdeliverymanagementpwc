-- Add delivery partner / courier name to dockets (new DC-first flow)
ALTER TABLE "dockets" ADD COLUMN "courier_name" TEXT;
