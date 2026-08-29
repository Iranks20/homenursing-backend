CREATE TYPE "NurseCoverageType" AS ENUM ('SIMULTANEOUS', 'DAY_SHIFT', 'NIGHT_SHIFT', 'WEEKLY_ROTATION', 'CUSTOM');

ALTER TABLE "nurse_patient_assignments" ADD COLUMN "coverageType" "NurseCoverageType" NOT NULL DEFAULT 'SIMULTANEOUS';
ALTER TABLE "nurse_patient_assignments" ADD COLUMN "periodStart" TIMESTAMP(3);
ALTER TABLE "nurse_patient_assignments" ADD COLUMN "periodEnd" TIMESTAMP(3);
ALTER TABLE "nurse_patient_assignments" ADD COLUMN "scheduleNotes" TEXT;
