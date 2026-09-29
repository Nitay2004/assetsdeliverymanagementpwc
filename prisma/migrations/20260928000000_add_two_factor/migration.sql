-- Two-factor authentication (TOTP) support:
--   * users.two_factor_enabled    -> login requires a second factor
--   * users.two_factor_secret     -> AES-256-GCM encrypted TOTP secret (ciphertext)
--   * users.two_factor_last_step  -> last accepted TOTP step, blocks code replay
--   * two_factor_recovery_codes  -> hashed one-time backup codes

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "two_factor_secret" TEXT,
ADD COLUMN "two_factor_last_step" BIGINT;

-- CreateTable
CREATE TABLE "two_factor_recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "two_factor_recovery_codes_user_id_idx" ON "two_factor_recovery_codes"("user_id");

-- AddForeignKey
ALTER TABLE "two_factor_recovery_codes"
ADD CONSTRAINT "two_factor_recovery_codes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
