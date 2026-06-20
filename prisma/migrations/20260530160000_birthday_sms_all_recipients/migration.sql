CREATE TYPE "BirthdaySmsRecipientType" AS ENUM ('PATIENT', 'USER', 'SPECIALIST', 'THERAPIST', 'NURSE');

ALTER TABLE "users" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "nurses" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "specialists" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "therapists" ADD COLUMN "dateOfBirth" TIMESTAMP(3);

ALTER TABLE "birthday_sms_deliveries" ADD COLUMN "recipientType" "BirthdaySmsRecipientType" NOT NULL DEFAULT 'PATIENT';
ALTER TABLE "birthday_sms_deliveries" ADD COLUMN "recipientId" TEXT;
UPDATE "birthday_sms_deliveries" SET "recipientId" = "patientId" WHERE "recipientId" IS NULL;
ALTER TABLE "birthday_sms_deliveries" ALTER COLUMN "recipientId" SET NOT NULL;
ALTER TABLE "birthday_sms_deliveries" RENAME COLUMN "patientName" TO "recipientName";

ALTER TABLE "birthday_sms_deliveries" DROP CONSTRAINT "birthday_sms_deliveries_patientId_fkey";
DROP INDEX "birthday_sms_deliveries_patientId_calendarYear_key";
ALTER TABLE "birthday_sms_deliveries" DROP COLUMN "patientId";

CREATE UNIQUE INDEX "birthday_sms_deliveries_recipientType_recipientId_calendarYear_key" ON "birthday_sms_deliveries"("recipientType", "recipientId", "calendarYear");
