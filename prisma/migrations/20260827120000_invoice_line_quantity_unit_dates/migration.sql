ALTER TABLE "invoice_line_items" ADD COLUMN "quantityUnit" TEXT;
ALTER TABLE "invoice_line_items" ADD COLUMN "serviceDateFrom" TIMESTAMP(3);
ALTER TABLE "invoice_line_items" ADD COLUMN "serviceDateTo" TIMESTAMP(3);
