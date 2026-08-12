-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "maxSupervisorsPerGroup" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "maxSupervisors" INTEGER;

-- CreateTable
CREATE TABLE "GroupSupervisor" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),

    CONSTRAINT "GroupSupervisor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupSupervisor_groupId_userId_key" ON "GroupSupervisor"("groupId", "userId");

-- CreateIndex
CREATE INDEX "GroupSupervisor_userId_idx" ON "GroupSupervisor"("userId");

-- AddForeignKey
ALTER TABLE "GroupSupervisor" ADD CONSTRAINT "GroupSupervisor_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "GroupSupervisor" ADD CONSTRAINT "GroupSupervisor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "GroupSupervisor" ADD CONSTRAINT "GroupSupervisor_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
