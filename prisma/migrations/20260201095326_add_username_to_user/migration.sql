/*
  Warnings:

  - The values [DOCTOR_REVIEW,SPECIALIST_TREATMENT] on the enum `PatientStage` will be removed. If these variants are still used in the database, this will fail.
  - The values [DOCTOR] on the enum `RecordRole` will be removed. If these variants are still used in the database, this will fail.
  - The values [DOCTOR] on the enum `ReferrerRole` will be removed. If these variants are still used in the database, this will fail.
  - The values [DOCTOR] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `doctor` on the `medical_records` table. All the data in the column will be lost.
  - You are about to drop the column `assignedDoctorId` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `referredSpecialistId` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `doctorSpecialization` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `specialist` to the `medical_records` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SpecialistSpecialization" AS ENUM ('NEUROLOGIST', 'ORTHOPEDIST', 'PHYSIOTHERAPIST');

-- CreateEnum
CREATE TYPE "TherapistSpecialization" AS ENUM ('PHYSIOTHERAPY', 'OCCUPATIONAL_THERAPY', 'SPEECH_THERAPY', 'SPORTS_THERAPY', 'PEDIATRIC_THERAPY', 'GERIATRIC_THERAPY');

-- CreateEnum
CREATE TYPE "TherapistStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "SpecializationType" AS ENUM ('SPECIALIST', 'THERAPIST');

-- AlterEnum
BEGIN;
CREATE TYPE "PatientStage_new" AS ENUM ('NEW', 'SPECIALIST_REVIEW', 'THERAPIST_TREATMENT', 'READY_FOR_DISCHARGE', 'DISCHARGED');
ALTER TABLE "patients" ALTER COLUMN "currentStage" DROP DEFAULT;
ALTER TABLE "patients" ALTER COLUMN "currentStage" TYPE "PatientStage_new" USING ("currentStage"::text::"PatientStage_new");
ALTER TYPE "PatientStage" RENAME TO "PatientStage_old";
ALTER TYPE "PatientStage_new" RENAME TO "PatientStage";
DROP TYPE "PatientStage_old";
ALTER TABLE "patients" ALTER COLUMN "currentStage" SET DEFAULT 'NEW';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "RecordRole_new" AS ENUM ('PATIENT', 'NURSE', 'SPECIALIST', 'THERAPIST', 'CAREGIVER');
ALTER TABLE "health_record_updates" ALTER COLUMN "updatedByRole" TYPE "RecordRole_new" USING ("updatedByRole"::text::"RecordRole_new");
ALTER TYPE "RecordRole" RENAME TO "RecordRole_old";
ALTER TYPE "RecordRole_new" RENAME TO "RecordRole";
DROP TYPE "RecordRole_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ReferrerRole_new" AS ENUM ('SPECIALIST', 'THERAPIST', 'NURSE');
ALTER TABLE "referrals" ALTER COLUMN "referredByRole" TYPE "ReferrerRole_new" USING ("referredByRole"::text::"ReferrerRole_new");
ALTER TYPE "ReferrerRole" RENAME TO "ReferrerRole_old";
ALTER TYPE "ReferrerRole_new" RENAME TO "ReferrerRole";
DROP TYPE "ReferrerRole_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'RECEPTIONIST', 'SPECIALIST', 'THERAPIST', 'NURSE', 'BILLER');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "patients" DROP CONSTRAINT "patients_assignedDoctorId_fkey";

-- DropForeignKey
ALTER TABLE "patients" DROP CONSTRAINT "patients_referredSpecialistId_fkey";

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "therapistId" TEXT;

-- AlterTable
ALTER TABLE "medical_records" DROP COLUMN "doctor",
ADD COLUMN     "specialist" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "patients" DROP COLUMN "assignedDoctorId",
DROP COLUMN "referredSpecialistId",
ADD COLUMN     "assignedSpecialistId" TEXT,
ADD COLUMN     "assignedTherapistId" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "doctorSpecialization",
ADD COLUMN     "specialistSpecialization" "SpecialistSpecialization",
ADD COLUMN     "therapistSpecialization" "TherapistSpecialization",
ADD COLUMN     "username" TEXT;

-- DropEnum
DROP TYPE "DoctorSpecialization";

-- CreateTable
CREATE TABLE "therapists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "experience" INTEGER NOT NULL,
    "certifications" TEXT[],
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "bio" TEXT,
    "status" "TherapistStatus" NOT NULL DEFAULT 'ACTIVE',
    "hireDate" TIMESTAMP(3) NOT NULL,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specializations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SpecializationType" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specializations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "therapists_email_key" ON "therapists"("email");

-- CreateIndex
CREATE UNIQUE INDEX "therapists_licenseNumber_key" ON "therapists"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "specializations_name_type_key" ON "specializations"("name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_assignedSpecialistId_fkey" FOREIGN KEY ("assignedSpecialistId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_assignedTherapistId_fkey" FOREIGN KEY ("assignedTherapistId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "therapists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
