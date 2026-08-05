BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Group] ADD [mealRateMode] NVARCHAR(1000) NOT NULL CONSTRAINT [Group_mealRateMode_df] DEFAULT 'MONTHLY',
[carryForwardEnabled] BIT NOT NULL CONSTRAINT [Group_carryForwardEnabled_df] DEFAULT 1;

-- AlterTable
ALTER TABLE [dbo].[SiteSettings] ADD [mealEditWindowMinutes] INT NOT NULL CONSTRAINT [SiteSettings_mealEditWindowMinutes_df] DEFAULT 5,
[mealEditRequiresApproval] BIT NOT NULL CONSTRAINT [SiteSettings_mealEditRequiresApproval_df] DEFAULT 1;

-- CreateTable
CREATE TABLE [dbo].[ExpenseCategory] (
    [id] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [label] NVARCHAR(1000) NOT NULL,
    [isSystem] BIT NOT NULL CONSTRAINT [ExpenseCategory_isSystem_df] DEFAULT 0,
    [sortOrder] INT NOT NULL CONSTRAINT [ExpenseCategory_sortOrder_df] DEFAULT 0,
    [archivedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseCategory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseCategory_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [ExpenseCategory_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [ExpenseCategory_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ExpenseCategory_groupId_code_key] UNIQUE NONCLUSTERED ([groupId],[code])
);

-- AlterTable
ALTER TABLE [dbo].[Notification] ADD [title] NVARCHAR(1000);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_groupId_createdAt_idx] ON [dbo].[Notification]([groupId], [createdAt]);

-- CreateTable
CREATE TABLE [dbo].[MealEditWindow] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [openedAt] DATETIME2 NOT NULL CONSTRAINT [MealEditWindow_openedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [expiresAt] DATETIME2,
    [closedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MealEditWindow_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [MealEditWindow_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [MealEditWindow_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [MealEditWindow_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MealEditWindow_userId_groupId_key] UNIQUE NONCLUSTERED ([userId],[groupId])
);

-- CreateTable
CREATE TABLE [dbo].[MealChangeRequest] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [fromBreakfast] INT NOT NULL CONSTRAINT [MealChangeRequest_fromBreakfast_df] DEFAULT 0,
    [fromLunch] INT NOT NULL CONSTRAINT [MealChangeRequest_fromLunch_df] DEFAULT 0,
    [fromDinner] INT NOT NULL CONSTRAINT [MealChangeRequest_fromDinner_df] DEFAULT 0,
    [toBreakfast] INT NOT NULL CONSTRAINT [MealChangeRequest_toBreakfast_df] DEFAULT 0,
    [toLunch] INT NOT NULL CONSTRAINT [MealChangeRequest_toLunch_df] DEFAULT 0,
    [toDinner] INT NOT NULL CONSTRAINT [MealChangeRequest_toDinner_df] DEFAULT 0,
    [reason] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [MealChangeRequest_status_df] DEFAULT 'PENDING',
    [decidedById] NVARCHAR(1000),
    [decidedAt] DATETIME2,
    [decisionNote] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MealChangeRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [MealChangeRequest_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [MealChangeRequest_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [MealChangeRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[MonthClosing] (
    [id] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [monthKey] NVARCHAR(1000) NOT NULL,
    [closedThrough] DATETIME2 NOT NULL,
    [closedById] NVARCHAR(1000),
    [note] NVARCHAR(1000),
    [reopenedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MonthClosing_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [MonthClosing_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [MonthClosing_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [MonthClosing_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ClosingLine] (
    [id] NVARCHAR(1000) NOT NULL,
    [closingId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [carryIn] FLOAT(53) NOT NULL CONSTRAINT [ClosingLine_carryIn_df] DEFAULT 0,
    [mealCount] FLOAT(53) NOT NULL CONSTRAINT [ClosingLine_mealCount_df] DEFAULT 0,
    [mealCost] FLOAT(53) NOT NULL CONSTRAINT [ClosingLine_mealCost_df] DEFAULT 0,
    [billShare] FLOAT(53) NOT NULL CONSTRAINT [ClosingLine_billShare_df] DEFAULT 0,
    [bazarPaid] FLOAT(53) NOT NULL CONSTRAINT [ClosingLine_bazarPaid_df] DEFAULT 0,
    [cashPaid] FLOAT(53) NOT NULL CONSTRAINT [ClosingLine_cashPaid_df] DEFAULT 0,
    [carryOut] FLOAT(53) NOT NULL CONSTRAINT [ClosingLine_carryOut_df] DEFAULT 0,
    [isFinal] BIT NOT NULL CONSTRAINT [ClosingLine_isFinal_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ClosingLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [ClosingLine_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [ClosingLine_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [ClosingLine_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ClosingLine_closingId_userId_key] UNIQUE NONCLUSTERED ([closingId],[userId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ExpenseCategory_groupId_archivedAt_idx] ON [dbo].[ExpenseCategory]([groupId], [archivedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MealEditWindow_expiresAt_idx] ON [dbo].[MealEditWindow]([expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MealChangeRequest_groupId_status_date_idx] ON [dbo].[MealChangeRequest]([groupId], [status], [date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MealChangeRequest_userId_status_idx] ON [dbo].[MealChangeRequest]([userId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MonthClosing_groupId_monthKey_idx] ON [dbo].[MonthClosing]([groupId], [monthKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ClosingLine_userId_idx] ON [dbo].[ClosingLine]([userId]);

-- AddForeignKey
ALTER TABLE [dbo].[ExpenseCategory] ADD CONSTRAINT [ExpenseCategory_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MealEditWindow] ADD CONSTRAINT [MealEditWindow_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MealEditWindow] ADD CONSTRAINT [MealEditWindow_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MealChangeRequest] ADD CONSTRAINT [MealChangeRequest_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MealChangeRequest] ADD CONSTRAINT [MealChangeRequest_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MealChangeRequest] ADD CONSTRAINT [MealChangeRequest_decidedById_fkey] FOREIGN KEY ([decidedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MonthClosing] ADD CONSTRAINT [MonthClosing_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MonthClosing] ADD CONSTRAINT [MonthClosing_closedById_fkey] FOREIGN KEY ([closedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ClosingLine] ADD CONSTRAINT [ClosingLine_closingId_fkey] FOREIGN KEY ([closingId]) REFERENCES [dbo].[MonthClosing]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ClosingLine] ADD CONSTRAINT [ClosingLine_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;

THROW

END CATCH
