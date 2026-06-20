CREATE TYPE "AppointmentReminderTiming" AS ENUM ('MID_DAY_BEFORE', 'TWENTY_FOUR_HOURS_BEFORE');

CREATE TYPE "BirthdaySmsDeliveryStatus" AS ENUM ('SCHEDULED', 'SENT', 'FAILED', 'SKIPPED');

ALTER TABLE "appointment_sms_reminders" ADD COLUMN "reminderTiming" "AppointmentReminderTiming" NOT NULL DEFAULT 'MID_DAY_BEFORE';

CREATE TABLE "birthday_sms_deliveries" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "calendarYear" INTEGER NOT NULL,
    "patientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "BirthdaySmsDeliveryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "sentAt" TIMESTAMP(3),
    "smsMessageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "birthday_sms_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "birthday_sms_deliveries_patientId_calendarYear_key" ON "birthday_sms_deliveries"("patientId", "calendarYear");

CREATE INDEX "birthday_sms_deliveries_scheduledAt_status_idx" ON "birthday_sms_deliveries"("scheduledAt", "status");

ALTER TABLE "birthday_sms_deliveries" ADD CONSTRAINT "birthday_sms_deliveries_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
