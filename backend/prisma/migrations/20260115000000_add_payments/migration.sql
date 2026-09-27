-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TESLAPAY');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- AlterTable: simulated TeslaPay wallet balance for every user (only
-- meaningful for passengers in this demo), starting at ৳100.00
ALTER TABLE "users" ADD COLUMN "walletBalancePaisa" INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE "users" ADD CONSTRAINT "users_wallet_nonnegative" CHECK ("walletBalancePaisa" >= 0);

-- AlterTable: payment method/status per ride request
ALTER TABLE "ride_requests" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH';
ALTER TABLE "ride_requests" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ride_requests" ADD COLUMN "paidAt" TIMESTAMP(3);
