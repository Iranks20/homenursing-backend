ALTER TABLE "invoice_line_items" ADD COLUMN "consultationProviderId" TEXT;

CREATE INDEX "invoice_line_items_consultationProviderId_idx" ON "invoice_line_items"("consultationProviderId");

ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_consultationProviderId_fkey" FOREIGN KEY ("consultationProviderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
