CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "procedureCode" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "lineAmount" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId");

ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "invoice_line_items" ("id", "invoiceId", "serviceId", "procedureCode", "description", "quantity", "unitPrice", "lineAmount", "sortOrder")
SELECT
    'ili_' || i."id",
    i."id",
    i."serviceId",
    NULL,
    i."description",
    1,
    i."amount",
    i."amount",
    0
FROM "invoices" i;

ALTER TABLE "invoices" ALTER COLUMN "serviceId" DROP NOT NULL;
