ALTER TABLE "invoice_line_items" ADD COLUMN "consultationSpecialistId" TEXT;

ALTER TABLE "invoice_line_items" ADD COLUMN "consultationTherapistId" TEXT;

CREATE INDEX "invoice_line_items_consultationSpecialistId_idx" ON "invoice_line_items"("consultationSpecialistId");

CREATE INDEX "invoice_line_items_consultationTherapistId_idx" ON "invoice_line_items"("consultationTherapistId");

ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_consultationSpecialistId_fkey" FOREIGN KEY ("consultationSpecialistId") REFERENCES "specialists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_consultationTherapistId_fkey" FOREIGN KEY ("consultationTherapistId") REFERENCES "therapists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
