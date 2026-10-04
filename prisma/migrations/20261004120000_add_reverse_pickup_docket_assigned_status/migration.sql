-- Reverse pickup docket number is assigned by Logistics *after* the DC and the
-- e-way bill, so the flow needs a terminal state for the docket queue before
-- the request can move on to inspection.

-- AlterEnum
ALTER TYPE "ReversePickupStatus" ADD VALUE IF NOT EXISTS 'DOCKET_ASSIGNED';
