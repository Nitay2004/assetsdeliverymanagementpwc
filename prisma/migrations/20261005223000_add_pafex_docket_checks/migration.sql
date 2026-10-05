-- Per-docket record of the last Pafex lookup. Lets the sync skip a cool-off
-- window for dockets Pafex reported as notFound instead of re-asking about them
-- on every run.
CREATE TABLE "pafex_docket_checks" (
    "docket_number" TEXT NOT NULL,
    "last_found" BOOLEAN NOT NULL DEFAULT false,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pafex_docket_checks_pkey" PRIMARY KEY ("docket_number")
);

CREATE INDEX "pafex_docket_checks_checked_at_idx" ON "pafex_docket_checks"("checked_at");