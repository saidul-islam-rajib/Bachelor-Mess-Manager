BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [password] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000),
    [profileImage] NVARCHAR(1000),
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'MEMBER',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [User_status_df] DEFAULT 'PENDING',
    [tokenVersion] INT NOT NULL CONSTRAINT [User_tokenVersion_df] DEFAULT 0,
    [lastLoginAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [User_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [User_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Group] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [supervisorId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Group_status_df] DEFAULT 'ACTIVE',
    [mealWeightBreakfast] FLOAT(53) NOT NULL CONSTRAINT [Group_mealWeightBreakfast_df] DEFAULT 0.5,
    [mealWeightLunch] FLOAT(53) NOT NULL CONSTRAINT [Group_mealWeightLunch_df] DEFAULT 1,
    [mealWeightDinner] FLOAT(53) NOT NULL CONSTRAINT [Group_mealWeightDinner_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Group_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [Group_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [Group_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [Group_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SiteSettings] (
    [id] NVARCHAR(1000) NOT NULL CONSTRAINT [SiteSettings_id_df] DEFAULT 'singleton',
    [companyName] NVARCHAR(1000) NOT NULL CONSTRAINT [SiteSettings_companyName_df] DEFAULT 'Team Sober',
    [tagline] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [contactEmail] NVARCHAR(1000),
    [contactPhone] NVARCHAR(1000),
    [copyrightOwner] NVARCHAR(1000) NOT NULL CONSTRAINT [SiteSettings_copyrightOwner_df] DEFAULT 'Team Sober',
    [facebookUrl] NVARCHAR(1000),
    [twitterUrl] NVARCHAR(1000),
    [newsletterEnabled] BIT NOT NULL CONSTRAINT [SiteSettings_newsletterEnabled_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SiteSettings_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [SiteSettings_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [SiteSettings_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [SiteSettings_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Subscriber] (
    [id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Subscriber_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [Subscriber_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [Subscriber_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [Subscriber_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Subscriber_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Invitation] (
    [id] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [inviteeId] NVARCHAR(1000) NOT NULL,
    [invitedById] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Invitation_status_df] DEFAULT 'PENDING',
    [respondedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Invitation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [Invitation_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [Invitation_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [Invitation_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Membership] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [joinedAt] DATETIME2 NOT NULL CONSTRAINT [Membership_joinedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [leftAt] DATETIME2,
    [isActive] BIT NOT NULL CONSTRAINT [Membership_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Membership_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [Membership_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [Membership_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [Membership_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[MealEntry] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [breakfastCount] INT NOT NULL CONSTRAINT [MealEntry_breakfastCount_df] DEFAULT 0,
    [lunchCount] INT NOT NULL CONSTRAINT [MealEntry_lunchCount_df] DEFAULT 0,
    [dinnerCount] INT NOT NULL CONSTRAINT [MealEntry_dinnerCount_df] DEFAULT 0,
    [totalMeals] INT NOT NULL CONSTRAINT [MealEntry_totalMeals_df] DEFAULT 0,
    [fromPlan] BIT NOT NULL CONSTRAINT [MealEntry_fromPlan_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MealEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [MealEntry_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [MealEntry_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [MealEntry_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MealEntry_userId_groupId_date_key] UNIQUE NONCLUSTERED ([userId],[groupId],[date])
);

-- CreateTable
CREATE TABLE [dbo].[MealPlan] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [MealPlan_isActive_df] DEFAULT 1,
    [startDate] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MealPlan_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [MealPlan_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [MealPlan_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [MealPlan_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MealPlan_userId_groupId_key] UNIQUE NONCLUSTERED ([userId],[groupId])
);

-- CreateTable
CREATE TABLE [dbo].[MealPlanDay] (
    [id] NVARCHAR(1000) NOT NULL,
    [planId] NVARCHAR(1000) NOT NULL,
    [weekday] INT NOT NULL,
    [enabled] BIT NOT NULL CONSTRAINT [MealPlanDay_enabled_df] DEFAULT 0,
    [breakfast] INT NOT NULL CONSTRAINT [MealPlanDay_breakfast_df] DEFAULT 0,
    [lunch] INT NOT NULL CONSTRAINT [MealPlanDay_lunch_df] DEFAULT 0,
    [dinner] INT NOT NULL CONSTRAINT [MealPlanDay_dinner_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MealPlanDay_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [MealPlanDay_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [MealPlanDay_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [MealPlanDay_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MealPlanDay_planId_weekday_key] UNIQUE NONCLUSTERED ([planId],[weekday])
);

-- CreateTable
CREATE TABLE [dbo].[ExpenseEntry] (
    [id] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [payerId] NVARCHAR(1000),
    [isReceived] BIT NOT NULL CONSTRAINT [ExpenseEntry_isReceived_df] DEFAULT 0,
    [splitMethod] NVARCHAR(1000) NOT NULL,
    [note] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseEntry_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [ExpenseEntry_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [ExpenseEntry_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ExpenseShare] (
    [id] NVARCHAR(1000) NOT NULL,
    [expenseId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseShare_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseShare_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [ExpenseShare_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [ExpenseShare_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ExpenseShare_expenseId_userId_key] UNIQUE NONCLUSTERED ([expenseId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[ExpenseItem] (
    [id] NVARCHAR(1000) NOT NULL,
    [expenseId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53) NOT NULL,
    [sortOrder] INT NOT NULL CONSTRAINT [ExpenseItem_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseItem_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [ExpenseItem_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [ExpenseItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ExpenseComment] (
    [id] NVARCHAR(1000) NOT NULL,
    [expenseId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [text] NVARCHAR(1000) NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseComment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseComment_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [ExpenseComment_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [ExpenseComment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PaymentStatus] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [expenseId] NVARCHAR(1000),
    [amountDue] FLOAT(53) NOT NULL,
    [amountPaid] FLOAT(53) NOT NULL CONSTRAINT [PaymentStatus_amountPaid_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL,
    [dueDate] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PaymentStatus_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [PaymentStatus_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [PaymentStatus_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [PaymentStatus_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[GroupOrder] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [position] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GroupOrder_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [GroupOrder_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [GroupOrder_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [GroupOrder_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [GroupOrder_userId_groupId_key] UNIQUE NONCLUSTERED ([userId],[groupId])
);

-- CreateTable
CREATE TABLE [dbo].[ExpenseHistory] (
    [id] NVARCHAR(1000) NOT NULL,
    [expenseId] NVARCHAR(1000),
    [groupId] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [action] NVARCHAR(1000) NOT NULL,
    [expenseDate] DATETIME2,
    [amountFrom] FLOAT(53),
    [amountTo] FLOAT(53),
    [dateFrom] DATETIME2,
    [dateTo] DATETIME2,
    [noteFrom] NVARCHAR(1000),
    [noteTo] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseHistory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [ExpenseHistory_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [ExpenseHistory_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [ExpenseHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CommentReply] (
    [id] NVARCHAR(1000) NOT NULL,
    [commentId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [text] NVARCHAR(1000) NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CommentReply_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [CommentReply_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [CommentReply_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [CommentReply_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Comment] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [groupId] NVARCHAR(1000) NOT NULL,
    [text] NVARCHAR(1000) NOT NULL,
    [deletedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Comment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdById] NVARCHAR(1000),
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [Comment_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedById] NVARCHAR(1000),
    [isPublished] BIT NOT NULL CONSTRAINT [Comment_isPublished_df] DEFAULT 1,
    [publishedAt] DATETIME2,
    [unpublishedAt] DATETIME2,
    CONSTRAINT [Comment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[Group] ADD CONSTRAINT [Group_supervisorId_fkey] FOREIGN KEY ([supervisorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Invitation] ADD CONSTRAINT [Invitation_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Invitation] ADD CONSTRAINT [Invitation_inviteeId_fkey] FOREIGN KEY ([inviteeId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Invitation] ADD CONSTRAINT [Invitation_invitedById_fkey] FOREIGN KEY ([invitedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Membership] ADD CONSTRAINT [Membership_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Membership] ADD CONSTRAINT [Membership_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MealEntry] ADD CONSTRAINT [MealEntry_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MealEntry] ADD CONSTRAINT [MealEntry_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MealPlan] ADD CONSTRAINT [MealPlan_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MealPlan] ADD CONSTRAINT [MealPlan_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MealPlanDay] ADD CONSTRAINT [MealPlanDay_planId_fkey] FOREIGN KEY ([planId]) REFERENCES [dbo].[MealPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ExpenseEntry] ADD CONSTRAINT [ExpenseEntry_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ExpenseEntry] ADD CONSTRAINT [ExpenseEntry_payerId_fkey] FOREIGN KEY ([payerId]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ExpenseShare] ADD CONSTRAINT [ExpenseShare_expenseId_fkey] FOREIGN KEY ([expenseId]) REFERENCES [dbo].[ExpenseEntry]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ExpenseShare] ADD CONSTRAINT [ExpenseShare_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ExpenseItem] ADD CONSTRAINT [ExpenseItem_expenseId_fkey] FOREIGN KEY ([expenseId]) REFERENCES [dbo].[ExpenseEntry]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ExpenseComment] ADD CONSTRAINT [ExpenseComment_expenseId_fkey] FOREIGN KEY ([expenseId]) REFERENCES [dbo].[ExpenseEntry]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ExpenseComment] ADD CONSTRAINT [ExpenseComment_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PaymentStatus] ADD CONSTRAINT [PaymentStatus_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PaymentStatus] ADD CONSTRAINT [PaymentStatus_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PaymentStatus] ADD CONSTRAINT [PaymentStatus_expenseId_fkey] FOREIGN KEY ([expenseId]) REFERENCES [dbo].[ExpenseEntry]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GroupOrder] ADD CONSTRAINT [GroupOrder_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GroupOrder] ADD CONSTRAINT [GroupOrder_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ExpenseHistory] ADD CONSTRAINT [ExpenseHistory_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ExpenseHistory] ADD CONSTRAINT [ExpenseHistory_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CommentReply] ADD CONSTRAINT [CommentReply_commentId_fkey] FOREIGN KEY ([commentId]) REFERENCES [dbo].[Comment]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CommentReply] ADD CONSTRAINT [CommentReply_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Comment] ADD CONSTRAINT [Comment_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Comment] ADD CONSTRAINT [Comment_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

