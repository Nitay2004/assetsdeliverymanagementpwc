-- AlterTable
ALTER TABLE "users" ADD COLUMN "permissions" JSONB;
ALTER TABLE "users" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
