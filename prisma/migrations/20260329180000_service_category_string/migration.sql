ALTER TABLE "services" ALTER COLUMN "category" SET DATA TYPE TEXT USING "category"::text;

DROP TYPE "ServiceCategory";
