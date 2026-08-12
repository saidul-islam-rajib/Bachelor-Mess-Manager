-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SiteSettings" ADD COLUMN     "disabledNotificationTypes" TEXT NOT NULL DEFAULT '';
