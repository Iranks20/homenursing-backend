ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;

UPDATE "invoices" AS i
SET "invoiceNumber" = sub.rn
FROM (
  SELECT id, LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt", id)::text, 6, '0') AS rn
  FROM "invoices"
) AS sub
WHERE sub.id = i.id;

ALTER TABLE "invoices" ALTER COLUMN "invoiceNumber" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");
