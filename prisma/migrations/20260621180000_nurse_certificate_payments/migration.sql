CREATE TYPE "CertificatePaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "nurse_certificate_payments" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "merchantReference" TEXT NOT NULL,
    "orderTrackingId" TEXT,
    "status" "CertificatePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "redirectUrl" TEXT,
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nurse_certificate_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nurse_certificate_payments_merchantReference_key" ON "nurse_certificate_payments"("merchantReference");

CREATE UNIQUE INDEX "nurse_certificate_payments_orderTrackingId_key" ON "nurse_certificate_payments"("orderTrackingId");

CREATE INDEX "nurse_certificate_payments_applicationId_status_idx" ON "nurse_certificate_payments"("applicationId", "status");

ALTER TABLE "nurse_certificate_payments" ADD CONSTRAINT "nurse_certificate_payments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "nurse_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nurse_certificate_payments" ADD CONSTRAINT "nurse_certificate_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
