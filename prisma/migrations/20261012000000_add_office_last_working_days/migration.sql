-- Office reverse pickups bundle several users on one request, so their last
-- working days are stored as a comma-separated list next to the per-user
-- name/serial/model lists on the same row. The singular last_working_day column
-- stays a real DATE for single-user requests.
ALTER TABLE "reverse_pickup_requests" ADD COLUMN "office_last_working_days" TEXT;
