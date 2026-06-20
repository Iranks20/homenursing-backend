-- Make email optional for users and patients
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "patients" ALTER COLUMN "email" DROP NOT NULL;
