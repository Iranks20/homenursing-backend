ALTER TABLE "payments"
ALTER COLUMN "method" TYPE TEXT
USING "method"::TEXT;
