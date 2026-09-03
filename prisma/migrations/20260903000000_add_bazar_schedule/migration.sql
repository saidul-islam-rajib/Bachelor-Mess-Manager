-- CreateTable
CREATE TABLE "BazarSchedule" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),

    CONSTRAINT "BazarSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BazarDutyDay" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),

    CONSTRAINT "BazarDutyDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BazarSchedule_groupId_monthKey_key" ON "BazarSchedule"("groupId", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "BazarDutyDay_scheduleId_day_key" ON "BazarDutyDay"("scheduleId", "day");

-- AddForeignKey
ALTER TABLE "BazarSchedule" ADD CONSTRAINT "BazarSchedule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "BazarDutyDay" ADD CONSTRAINT "BazarDutyDay_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "BazarSchedule"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "BazarDutyDay" ADD CONSTRAINT "BazarDutyDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
