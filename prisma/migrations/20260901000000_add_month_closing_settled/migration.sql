-- AlterTable
ALTER TABLE "MonthClosing" ADD COLUMN     "settledAt" TIMESTAMP(3);
ALTER TABLE "MonthClosing" ADD COLUMN     "settledById" TEXT;

-- AddForeignKey
ALTER TABLE "MonthClosing" ADD CONSTRAINT "MonthClosing_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
