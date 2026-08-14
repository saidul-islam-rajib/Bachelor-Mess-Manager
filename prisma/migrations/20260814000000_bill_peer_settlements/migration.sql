-- AlterTable
ALTER TABLE "PaymentStatus" ADD COLUMN     "toUserId" TEXT;
ALTER TABLE "PaymentStatus" ADD COLUMN     "offsetOfId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentStatus_offsetOfId_key" ON "PaymentStatus"("offsetOfId");

-- CreateIndex
CREATE INDEX "PaymentStatus_toUserId_idx" ON "PaymentStatus"("toUserId");

-- AddForeignKey
ALTER TABLE "PaymentStatus" ADD CONSTRAINT "PaymentStatus_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PaymentStatus" ADD CONSTRAINT "PaymentStatus_offsetOfId_fkey" FOREIGN KEY ("offsetOfId") REFERENCES "PaymentStatus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
