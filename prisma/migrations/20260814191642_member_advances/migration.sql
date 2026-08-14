-- AlterTable
ALTER TABLE "PaymentStatus" ADD COLUMN     "fromAdvance" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MemberAdvance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "expenseId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "recordedById" TEXT,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),

    CONSTRAINT "MemberAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberAdvance_reversalOfId_key" ON "MemberAdvance"("reversalOfId");

-- CreateIndex
CREATE INDEX "MemberAdvance_groupId_userId_idx" ON "MemberAdvance"("groupId", "userId");

-- CreateIndex
CREATE INDEX "MemberAdvance_expenseId_idx" ON "MemberAdvance"("expenseId");

-- AddForeignKey
ALTER TABLE "MemberAdvance" ADD CONSTRAINT "MemberAdvance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MemberAdvance" ADD CONSTRAINT "MemberAdvance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MemberAdvance" ADD CONSTRAINT "MemberAdvance_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "ExpenseEntry"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MemberAdvance" ADD CONSTRAINT "MemberAdvance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MemberAdvance" ADD CONSTRAINT "MemberAdvance_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "MemberAdvance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
