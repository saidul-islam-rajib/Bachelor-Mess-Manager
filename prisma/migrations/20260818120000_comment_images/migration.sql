-- CreateTable
CREATE TABLE "CommentImage" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),

    CONSTRAINT "CommentImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentImage_commentId_idx" ON "CommentImage"("commentId");

-- AddForeignKey
ALTER TABLE "CommentImage" ADD CONSTRAINT "CommentImage_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
