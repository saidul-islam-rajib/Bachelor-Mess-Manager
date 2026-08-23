ALTER TABLE "CommunityMessage"
  ADD COLUMN "houseRules" TEXT,
  ADD COLUMN "seatsAvailable" INTEGER,
  ADD COLUMN "attachedBath" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "attachedBalcony" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "serviceChargeIncluded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "advanceMonths" INTEGER,
  ADD COLUMN "amenities" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "mealsProvided" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "contactWhatsapp" TEXT;

ALTER TABLE "SiteSettings"
  ADD COLUMN "toLetPostLayout" TEXT NOT NULL DEFAULT 'SIGNBOARD';
