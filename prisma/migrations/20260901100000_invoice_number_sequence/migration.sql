CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

SELECT setval(
  'invoice_number_seq',
  COALESCE(
    (
      SELECT MAX(CAST("invoiceNumber" AS INTEGER))
      FROM "invoices"
      WHERE "invoiceNumber" ~ '^[0-9]+$'
    ),
    0
  ),
  true
);
