-- CreateEnum
CREATE TYPE "InvestigationRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'LAB_ATTENDANT';

-- CreateTable
CREATE TABLE "investigation_requests" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "requestedByRole" TEXT NOT NULL,
    "investigationName" TEXT NOT NULL,
    "status" "InvestigationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority" NOT NULL DEFAULT 'ROUTINE',
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "labSampleId" TEXT,
    "completedById" TEXT,
    "completedByName" TEXT,

    CONSTRAINT "investigation_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "investigation_requests" ADD CONSTRAINT "investigation_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
