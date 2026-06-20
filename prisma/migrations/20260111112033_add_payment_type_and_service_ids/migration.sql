-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CASH', 'INSURANCE');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "paymentType" "PaymentType" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
