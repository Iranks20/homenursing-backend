CREATE TYPE "AppointmentSmsReminderStatus" AS ENUM ('SCHEDULED', 'SENT', 'PARTIAL', 'FAILED', 'CANCELLED', 'SKIPPED');

CREATE TABLE "appointment_sms_reminders" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentSmsReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "patientSentAt" TIMESTAMP(3),
    "patientSmsMessageId" TEXT,
    "patientSendError" TEXT,
    "providerType" TEXT,
    "providerId" TEXT,
    "providerName" TEXT,
    "providerPhone" TEXT,
    "providerSentAt" TIMESTAMP(3),
    "providerSmsMessageId" TEXT,
    "providerSendError" TEXT,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "appointmentTime" TEXT NOT NULL,
    "serviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_sms_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "appointment_sms_reminders_appointmentId_key" ON "appointment_sms_reminders"("appointmentId");

CREATE INDEX "appointment_sms_reminders_scheduledAt_status_idx" ON "appointment_sms_reminders"("scheduledAt", "status");

ALTER TABLE "appointment_sms_reminders" ADD CONSTRAINT "appointment_sms_reminders_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
