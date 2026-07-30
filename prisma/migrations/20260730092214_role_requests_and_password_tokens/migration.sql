BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[SiteSettings] ADD [allowSelfRoleSwitch] BIT NOT NULL CONSTRAINT [SiteSettings_allowSelfRoleSwitch_df] DEFAULT 1,
[autoApproveSupervisor] BIT NOT NULL CONSTRAINT [SiteSettings_autoApproveSupervisor_df] DEFAULT 0;

-- CreateTable
CREATE TABLE [dbo].[RoleRequest] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [requestedRole] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [RoleRequest_status_df] DEFAULT 'PENDING',
    [reason] NVARCHAR(1000),
    [decidedById] NVARCHAR(1000),
    [decidedAt] DATETIME2,
    [decisionNote] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RoleRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [RoleRequest_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [RoleRequest_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [RoleRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PasswordToken] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [tokenHash] NVARCHAR(1000) NOT NULL,
    [purpose] NVARCHAR(1000) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [usedAt] DATETIME2,
    [requestedIp] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PasswordToken_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [PasswordToken_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [PasswordToken_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [PasswordToken_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PasswordToken_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RoleRequest_userId_status_idx] ON [dbo].[RoleRequest]([userId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RoleRequest_status_createdAt_idx] ON [dbo].[RoleRequest]([status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PasswordToken_userId_purpose_idx] ON [dbo].[PasswordToken]([userId], [purpose]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PasswordToken_expiresAt_idx] ON [dbo].[PasswordToken]([expiresAt]);

-- AddForeignKey
ALTER TABLE [dbo].[RoleRequest] ADD CONSTRAINT [RoleRequest_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RoleRequest] ADD CONSTRAINT [RoleRequest_decidedById_fkey] FOREIGN KEY ([decidedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PasswordToken] ADD CONSTRAINT [PasswordToken_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
