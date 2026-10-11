CREATE TYPE "PatientBillingFrequency" AS ENUM ('DAILY', 'MONTHLY');

ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'BILLING';

ALTER TABLE "patients" ADD COLUMN "billingFrequency" "PatientBillingFrequency";
ALTER TABLE "patients" ADD COLUMN "agreedServiceAmount" INTEGER;
