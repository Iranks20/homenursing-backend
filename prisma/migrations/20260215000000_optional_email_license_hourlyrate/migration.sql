-- Make email, licenseNumber, and hourlyRate optional for nurses, specialists, and therapists

-- Nurses
ALTER TABLE "nurses" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "nurses" ALTER COLUMN "licenseNumber" DROP NOT NULL;

-- Specialists
ALTER TABLE "specialists" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "specialists" ALTER COLUMN "licenseNumber" DROP NOT NULL;
ALTER TABLE "specialists" ALTER COLUMN "hourlyRate" DROP NOT NULL;

-- Therapists
ALTER TABLE "therapists" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "therapists" ALTER COLUMN "licenseNumber" DROP NOT NULL;
ALTER TABLE "therapists" ALTER COLUMN "hourlyRate" DROP NOT NULL;
