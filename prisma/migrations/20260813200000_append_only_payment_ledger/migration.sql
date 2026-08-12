-- AlterTable
ALTER TABLE "PaymentStatus" ADD COLUMN     "reversalOfId" TEXT;
ALTER TABLE "PaymentStatus" ADD COLUMN     "recordedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentStatus_reversalOfId_key" ON "PaymentStatus"("reversalOfId");

-- AddForeignKey
ALTER TABLE "PaymentStatus" ADD CONSTRAINT "PaymentStatus_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "PaymentStatus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PaymentStatus" ADD CONSTRAINT "PaymentStatus_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
