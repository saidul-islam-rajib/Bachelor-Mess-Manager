BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[CommunityMessage] (
    [id] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL CONSTRAINT [CommunityMessage_type_df] DEFAULT 'MEMBER',
    [key] NVARCHAR(1000),
    [authorId] NVARCHAR(1000),
    [title] NVARCHAR(1000),
    [text] NVARCHAR(1000) NOT NULL,
    [pinned] BIT NOT NULL CONSTRAINT [CommunityMessage_pinned_df] DEFAULT 0,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CommunityMessage_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [CommunityMessage_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [CommunityMessage_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [CommunityMessage_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CommunityMessage_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[CommunityRead] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [lastReadAt] DATETIME2 NOT NULL CONSTRAINT [CommunityRead_lastReadAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CommunityRead_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [CommunityRead_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [CommunityRead_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [CommunityRead_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CommunityRead_userId_key] UNIQUE NONCLUSTERED ([userId])
);

-- CreateTable
CREATE TABLE [dbo].[MealPrompt] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [tokenHash] NVARCHAR(1000) NOT NULL,
    [channel] NVARCHAR(1000) NOT NULL CONSTRAINT [MealPrompt_channel_df] DEFAULT 'EMAIL',
    [answer] NVARCHAR(1000),
    [answeredBreakfast] INT,
    [answeredLunch] INT,
    [answeredDinner] INT,
    [respondedAt] DATETIME2,
    [sentAt] DATETIME2,
    [expiresAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MealPrompt_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [MealPrompt_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [MealPrompt_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [MealPrompt_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MealPrompt_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash]),
    CONSTRAINT [MealPrompt_userId_groupId_date_key] UNIQUE NONCLUSTERED ([userId],[groupId],[date])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CommunityMessage_createdAt_idx] ON [dbo].[CommunityMessage]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CommunityMessage_pinned_createdAt_idx] ON [dbo].[CommunityMessage]([pinned], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MealPrompt_groupId_date_idx] ON [dbo].[MealPrompt]([groupId], [date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MealPrompt_expiresAt_idx] ON [dbo].[MealPrompt]([expiresAt]);

-- AddForeignKey
ALTER TABLE [dbo].[CommunityMessage] ADD CONSTRAINT [CommunityMessage_authorId_fkey] FOREIGN KEY ([authorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CommunityRead] ADD CONSTRAINT [CommunityRead_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MealPrompt] ADD CONSTRAINT [MealPrompt_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MealPrompt] ADD CONSTRAINT [MealPrompt_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

