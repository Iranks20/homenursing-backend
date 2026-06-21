CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

CREATE TYPE "NurseApplicationStatus" AS ENUM ('EXAM_PENDING', 'EXAM_FAILED', 'EXAM_PASSED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_PASSED', 'INTERVIEW_FAILED', 'CERTIFIED', 'RECRUITED');

CREATE TYPE "PayFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

ALTER TYPE "UserRole" ADD VALUE 'APPLICANT';
ALTER TYPE "UserRole" ADD VALUE 'TRAINER';
ALTER TYPE "UserRole" ADD VALUE 'SUPERVISOR';

ALTER TABLE "birthday_sms_deliveries" ALTER COLUMN "recipientType" DROP DEFAULT;

ALTER TABLE "patients" ADD COLUMN "location" TEXT;

ALTER TABLE "users" ADD COLUMN "payFrequency" "PayFrequency",
ADD COLUMN "workStartDate" TIMESTAMP(3);

CREATE TABLE "nurse_patient_assignments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "notes" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nurse_patient_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nurse_supervision_reports" (
    "id" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "patientId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nurse_supervision_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nurse_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "experience" INTEGER,
    "message" TEXT,
    "qualificationDocuments" JSONB,
    "qualificationDriveLink" TEXT,
    "status" "NurseApplicationStatus" NOT NULL DEFAULT 'EXAM_PENDING',
    "passedAttemptId" TEXT,
    "interviewScheduledAt" TIMESTAMP(3),
    "interviewNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nurse_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "nurse_patient_assignments_patientId_status_idx" ON "nurse_patient_assignments"("patientId", "status");

CREATE INDEX "nurse_patient_assignments_nurseId_status_idx" ON "nurse_patient_assignments"("nurseId", "status");

CREATE INDEX "nurse_supervision_reports_supervisorId_idx" ON "nurse_supervision_reports"("supervisorId");

CREATE INDEX "nurse_supervision_reports_nurseId_idx" ON "nurse_supervision_reports"("nurseId");

CREATE UNIQUE INDEX "nurse_applications_userId_key" ON "nurse_applications"("userId");

CREATE UNIQUE INDEX "nurse_applications_passedAttemptId_key" ON "nurse_applications"("passedAttemptId");

ALTER TABLE "nurse_patient_assignments" ADD CONSTRAINT "nurse_patient_assignments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nurse_patient_assignments" ADD CONSTRAINT "nurse_patient_assignments_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "nurse_patient_assignments" ADD CONSTRAINT "nurse_patient_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "nurse_supervision_reports" ADD CONSTRAINT "nurse_supervision_reports_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "nurse_supervision_reports" ADD CONSTRAINT "nurse_supervision_reports_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "nurse_supervision_reports" ADD CONSTRAINT "nurse_supervision_reports_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "nurse_applications" ADD CONSTRAINT "nurse_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nurse_applications" ADD CONSTRAINT "nurse_applications_passedAttemptId_fkey" FOREIGN KEY ("passedAttemptId") REFERENCES "training_exam_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "nurse_applications" ADD CONSTRAINT "nurse_applications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER INDEX "birthday_sms_deliveries_recipientType_recipientId_calendarYear_" RENAME TO "birthday_sms_deliveries_recipientType_recipientId_calendarY_key";
