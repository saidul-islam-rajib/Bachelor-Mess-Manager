-- CreateTable
CREATE TABLE "SettlementSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "closingId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "mealRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meals" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carryIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mealCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bazarPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueAtClose" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payableByType" JSONB NOT NULL,
    "paidByType" JSONB NOT NULL,
    "transfers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),

    CONSTRAINT "SettlementSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SettlementSubmission_userId_submittedAt_idx" ON "SettlementSubmission"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "SettlementSubmission_groupId_monthKey_idx" ON "SettlementSubmission"("groupId", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementSubmission_closingId_userId_key" ON "SettlementSubmission"("closingId", "userId");

-- AddForeignKey
ALTER TABLE "SettlementSubmission" ADD CONSTRAINT "SettlementSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SettlementSubmission" ADD CONSTRAINT "SettlementSubmission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SettlementSubmission" ADD CONSTRAINT "SettlementSubmission_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "MonthClosing"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SettlementSubmission" ADD CONSTRAINT "SettlementSubmission_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
