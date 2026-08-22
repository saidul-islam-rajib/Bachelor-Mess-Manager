-- AlterTable
ALTER TABLE "CommunityMessage" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- EnableExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "CommunityMessage_title_trgm_idx" ON "CommunityMessage" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "CommunityMessage_location_trgm_idx" ON "CommunityMessage" USING GIN ("location" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "CommunityMessage_text_trgm_idx" ON "CommunityMessage" USING GIN ("text" gin_trgm_ops);
