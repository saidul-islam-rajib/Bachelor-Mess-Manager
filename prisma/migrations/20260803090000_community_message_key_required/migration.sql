BEGIN TRY

BEGIN TRAN;

-- DropConstraint
ALTER TABLE [dbo].[CommunityMessage] DROP CONSTRAINT [CommunityMessage_key_key];

-- Backfill
UPDATE [dbo].[CommunityMessage] SET [key] = CONCAT(N'message:', LOWER(CONVERT(NVARCHAR(36), NEWID()))) WHERE [key] IS NULL;

-- AlterTable
ALTER TABLE [dbo].[CommunityMessage] ALTER COLUMN [key] NVARCHAR(1000) NOT NULL;

-- AddConstraint
ALTER TABLE [dbo].[CommunityMessage] ADD CONSTRAINT [CommunityMessage_key_key] UNIQUE NONCLUSTERED ([key]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
