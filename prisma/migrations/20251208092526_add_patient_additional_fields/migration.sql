-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "currentMedications" TEXT,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "emergencyPhone" TEXT,
ADD COLUMN     "insuranceNumber" TEXT,
ADD COLUMN     "insuranceProvider" TEXT,
ADD COLUMN     "referralSource" TEXT;
