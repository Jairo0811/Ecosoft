BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[Organization] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [rnc] VARCHAR(11),
    [legalName] NVARCHAR(200) NOT NULL,
    [commercialName] NVARCHAR(200),
    [type] VARCHAR(40) NOT NULL,
    [status] VARCHAR(30) NOT NULL CONSTRAINT [Organization_status_df] DEFAULT 'PENDING',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Organization_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Organization_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Organization_rnc_key] UNIQUE NONCLUSTERED ([rnc])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [email] NVARCHAR(320) NOT NULL,
    [passwordHash] VARCHAR(100) NOT NULL,
    [firstName] NVARCHAR(100) NOT NULL,
    [lastName] NVARCHAR(100) NOT NULL,
    [status] VARCHAR(30) NOT NULL CONSTRAINT [User_status_df] DEFAULT 'PENDING_CONFIRMATION',
    [emailConfirmedAt] DATETIME2,
    [failedLoginAttempts] INT NOT NULL CONSTRAINT [User_failedLoginAttempts_df] DEFAULT 0,
    [lockedUntil] DATETIME2,
    [lastLoginAt] DATETIME2,
    [organizationId] UNIQUEIDENTIFIER,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] VARCHAR(60) NOT NULL,
    [name] NVARCHAR(120) NOT NULL,
    [description] NVARCHAR(500),
    [isSystem] BIT NOT NULL CONSTRAINT [Role_isSystem_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Role_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Role_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Permission] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] VARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    CONSTRAINT [Permission_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Permission_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[UserRole] (
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [roleId] UNIQUEIDENTIFIER NOT NULL,
    [assignedAt] DATETIME2 NOT NULL CONSTRAINT [UserRole_assignedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [UserRole_pkey] PRIMARY KEY CLUSTERED ([userId],[roleId])
);

-- CreateTable
CREATE TABLE [dbo].[RolePermission] (
    [roleId] UNIQUEIDENTIFIER NOT NULL,
    [permissionId] UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT [RolePermission_pkey] PRIMARY KEY CLUSTERED ([roleId],[permissionId])
);

-- CreateTable
CREATE TABLE [dbo].[RefreshToken] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [familyId] UNIQUEIDENTIFIER NOT NULL,
    [jti] UNIQUEIDENTIFIER NOT NULL,
    [tokenHash] CHAR(64) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [revokedAt] DATETIME2,
    [ipAddress] VARCHAR(64),
    [userAgent] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RefreshToken_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RefreshToken_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RefreshToken_jti_key] UNIQUE NONCLUSTERED ([jti]),
    CONSTRAINT [RefreshToken_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLog] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [userId] UNIQUEIDENTIFIER,
    [organizationId] UNIQUEIDENTIFIER,
    [action] VARCHAR(40) NOT NULL,
    [module] VARCHAR(60) NOT NULL,
    [entity] VARCHAR(100),
    [entityId] VARCHAR(100),
    [result] VARCHAR(30) NOT NULL,
    [ipAddress] VARCHAR(64),
    [userAgent] NVARCHAR(500),
    [correlationId] UNIQUEIDENTIFIER NOT NULL,
    [previousValues] NVARCHAR(max),
    [newValues] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Organization_type_status_idx] ON [dbo].[Organization]([type], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_organizationId_status_idx] ON [dbo].[User]([organizationId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_userId_familyId_idx] ON [dbo].[RefreshToken]([userId], [familyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_expiresAt_revokedAt_idx] ON [dbo].[RefreshToken]([expiresAt], [revokedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_createdAt_idx] ON [dbo].[AuditLog]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_userId_action_idx] ON [dbo].[AuditLog]([userId], [action]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_module_entity_entityId_idx] ON [dbo].[AuditLog]([module], [entity], [entityId]);

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_organizationId_fkey] FOREIGN KEY ([organizationId]) REFERENCES [dbo].[Organization]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserRole] ADD CONSTRAINT [UserRole_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserRole] ADD CONSTRAINT [UserRole_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_permissionId_fkey] FOREIGN KEY ([permissionId]) REFERENCES [dbo].[Permission]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RefreshToken] ADD CONSTRAINT [RefreshToken_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AuditLog] ADD CONSTRAINT [AuditLog_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
