-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "mealEditRequiresApproval" BOOLEAN;

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "startHour" INTEGER NOT NULL DEFAULT 0,
    "startWeekday" INTEGER NOT NULL DEFAULT 0,
    "startDay" TEXT NOT NULL DEFAULT '',
    "device" TEXT NOT NULL DEFAULT 'DESKTOP',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSession_userId_startedAt_idx" ON "UserSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "UserSession_startedAt_idx" ON "UserSession"("startedAt");

-- CreateIndex
CREATE INDEX "UserSession_userId_endedAt_idx" ON "UserSession"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "UserSession_startDay_idx" ON "UserSession"("startDay");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

