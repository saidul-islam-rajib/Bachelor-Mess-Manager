-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "bazarReminderEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Group" ADD COLUMN     "bazarReminderTime" TEXT NOT NULL DEFAULT '07:00';
