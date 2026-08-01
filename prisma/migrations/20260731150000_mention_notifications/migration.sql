BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Notification] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [type] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000),
    [excerpt] NVARCHAR(1000),
    [link] NVARCHAR(1000) NOT NULL,
    [readAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Notification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [Notification_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [Notification_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [Notification_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_userId_readAt_idx] ON [dbo].[Notification]([userId], [readAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_userId_createdAt_idx] ON [dbo].[Notification]([userId], [createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;

THROW

END CATCH
