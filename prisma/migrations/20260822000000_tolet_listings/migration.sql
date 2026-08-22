-- CreateTable
CREATE TABLE "ToLetListing" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rent" DOUBLE PRECISION NOT NULL,
    "rentNegotiable" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT NOT NULL,
    "genderPreference" TEXT NOT NULL DEFAULT 'ANY',
    "availableFrom" TIMESTAMP(3),
    "contactPhone" TEXT,
    "contactName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),

    CONSTRAINT "ToLetListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToLetImage" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),

    CONSTRAINT "ToLetImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToLetLike" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToLetLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToLetComment" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),

    CONSTRAINT "ToLetComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToLetListing_status_expiresAt_idx" ON "ToLetListing"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ToLetListing_authorId_idx" ON "ToLetListing"("authorId");

-- CreateIndex
CREATE INDEX "ToLetListing_createdAt_idx" ON "ToLetListing"("createdAt");

-- CreateIndex
CREATE INDEX "ToLetListing_type_idx" ON "ToLetListing"("type");

-- CreateIndex
CREATE INDEX "ToLetImage_listingId_idx" ON "ToLetImage"("listingId");

-- CreateIndex
CREATE INDEX "ToLetLike_userId_idx" ON "ToLetLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ToLetLike_listingId_userId_key" ON "ToLetLike"("listingId", "userId");

-- CreateIndex
CREATE INDEX "ToLetComment_listingId_createdAt_idx" ON "ToLetComment"("listingId", "createdAt");

-- AddForeignKey
ALTER TABLE "ToLetListing" ADD CONSTRAINT "ToLetListing_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ToLetImage" ADD CONSTRAINT "ToLetImage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ToLetListing"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ToLetLike" ADD CONSTRAINT "ToLetLike_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ToLetListing"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ToLetLike" ADD CONSTRAINT "ToLetLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ToLetComment" ADD CONSTRAINT "ToLetComment_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ToLetListing"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ToLetComment" ADD CONSTRAINT "ToLetComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
