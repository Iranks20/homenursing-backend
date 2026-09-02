-- Add "where the nurse stays" and two next-of-kin contact pairs to nurses.
ALTER TABLE "nurses" ADD COLUMN "location" TEXT;
ALTER TABLE "nurses" ADD COLUMN "nextOfKinName1" TEXT;
ALTER TABLE "nurses" ADD COLUMN "nextOfKinPhone1" TEXT;
ALTER TABLE "nurses" ADD COLUMN "nextOfKinName2" TEXT;
ALTER TABLE "nurses" ADD COLUMN "nextOfKinPhone2" TEXT;
