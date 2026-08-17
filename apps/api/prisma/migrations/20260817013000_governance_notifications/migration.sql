ALTER TABLE [dbo].[AuditLog] ADD [eventHash] CHAR(64) NULL;

CREATE NONCLUSTERED INDEX [AuditLog_eventHash_idx]
ON [dbo].[AuditLog]([eventHash]);

CREATE TABLE [dbo].[Regulation] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] VARCHAR(80) NOT NULL,
    [title] NVARCHAR(300) NOT NULL,
    [summary] NVARCHAR(2000) NULL,
    [type] VARCHAR(30) NOT NULL,
    [status] VARCHAR(30) NOT NULL CONSTRAINT [Regulation_status_df] DEFAULT 'BORRADOR',
    [issuingOrganizationId] UNIQUEIDENTIFIER NOT NULL,
    [effectiveFrom] DATETIME2 NOT NULL,
    [effectiveTo] DATETIME2 NULL,
    [sourceUrl] NVARCHAR(1000) NULL,
    [documentReference] NVARCHAR(500) NULL,
    [createdByUserId] UNIQUEIDENTIFIER NOT NULL,
    [approvedByUserId] UNIQUEIDENTIFIER NULL,
    [approvedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Regulation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Regulation_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Regulation_type_check] CHECK ([type] IN ('NORMATIVA', 'RESOLUCION', 'REGLAMENTO')),
    CONSTRAINT [Regulation_status_check] CHECK ([status] IN ('BORRADOR', 'VIGENTE', 'SUSPENDIDA', 'DEROGADA')),
    CONSTRAINT [Regulation_effective_dates_check] CHECK ([effectiveTo] IS NULL OR [effectiveTo] >= [effectiveFrom])
);

CREATE UNIQUE NONCLUSTERED INDEX [Regulation_code_key] ON [dbo].[Regulation]([code]);
CREATE NONCLUSTERED INDEX [Regulation_status_effectiveFrom_idx]
ON [dbo].[Regulation]([status], [effectiveFrom]);
CREATE NONCLUSTERED INDEX [Regulation_issuingOrganizationId_type_status_idx]
ON [dbo].[Regulation]([issuingOrganizationId], [type], [status]);

CREATE TABLE [dbo].[RegulationScope] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [regulationId] UNIQUEIDENTIFIER NOT NULL,
    [entityType] VARCHAR(40) NOT NULL,
    [entityId] VARCHAR(100) NOT NULL,
    [notes] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RegulationScope_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RegulationScope_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RegulationScope_entityType_check] CHECK ([entityType] IN ('AUCTION', 'PPA_CONTRACT', 'ENERGY_PROJECT', 'EVALUATION'))
);

CREATE UNIQUE NONCLUSTERED INDEX [RegulationScope_regulationId_entityType_entityId_key]
ON [dbo].[RegulationScope]([regulationId], [entityType], [entityId]);
CREATE NONCLUSTERED INDEX [RegulationScope_entityType_entityId_idx]
ON [dbo].[RegulationScope]([entityType], [entityId]);

CREATE TABLE [dbo].[RegulationEvent] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [regulationId] UNIQUEIDENTIFIER NOT NULL,
    [changedByUserId] UNIQUEIDENTIFIER NOT NULL,
    [action] VARCHAR(40) NOT NULL,
    [previousStatus] VARCHAR(30) NULL,
    [newStatus] VARCHAR(30) NULL,
    [reason] NVARCHAR(1000) NULL,
    [snapshotJson] NVARCHAR(MAX) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RegulationEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RegulationEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [RegulationEvent_regulationId_createdAt_idx]
ON [dbo].[RegulationEvent]([regulationId], [createdAt]);

CREATE TABLE [dbo].[Notification] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [organizationId] UNIQUEIDENTIFIER NULL,
    [sourceKey] VARCHAR(220) NOT NULL,
    [type] VARCHAR(50) NOT NULL,
    [severity] VARCHAR(20) NOT NULL CONSTRAINT [Notification_severity_df] DEFAULT 'INFO',
    [title] NVARCHAR(240) NOT NULL,
    [message] NVARCHAR(1200) NOT NULL,
    [entityType] VARCHAR(50) NULL,
    [entityId] VARCHAR(100) NULL,
    [actionUrl] NVARCHAR(500) NULL,
    [emailStatus] VARCHAR(30) NOT NULL CONSTRAINT [Notification_emailStatus_df] DEFAULT 'NOT_CONFIGURED',
    [readAt] DATETIME2 NULL,
    [expiresAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Notification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Notification_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Notification_severity_check] CHECK ([severity] IN ('INFO', 'WARNING', 'CRITICAL'))
);

CREATE UNIQUE NONCLUSTERED INDEX [Notification_userId_sourceKey_key]
ON [dbo].[Notification]([userId], [sourceKey]);
CREATE NONCLUSTERED INDEX [Notification_userId_readAt_createdAt_idx]
ON [dbo].[Notification]([userId], [readAt], [createdAt]);
CREATE NONCLUSTERED INDEX [Notification_organizationId_type_createdAt_idx]
ON [dbo].[Notification]([organizationId], [type], [createdAt]);

ALTER TABLE [dbo].[Regulation] ADD CONSTRAINT [Regulation_issuingOrganizationId_fkey]
FOREIGN KEY ([issuingOrganizationId]) REFERENCES [dbo].[Organization]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Regulation] ADD CONSTRAINT [Regulation_createdByUserId_fkey]
FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Regulation] ADD CONSTRAINT [Regulation_approvedByUserId_fkey]
FOREIGN KEY ([approvedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[RegulationScope] ADD CONSTRAINT [RegulationScope_regulationId_fkey]
FOREIGN KEY ([regulationId]) REFERENCES [dbo].[Regulation]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[RegulationEvent] ADD CONSTRAINT [RegulationEvent_regulationId_fkey]
FOREIGN KEY ([regulationId]) REFERENCES [dbo].[Regulation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[RegulationEvent] ADD CONSTRAINT [RegulationEvent_changedByUserId_fkey]
FOREIGN KEY ([changedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_userId_fkey]
FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_organizationId_fkey]
FOREIGN KEY ([organizationId]) REFERENCES [dbo].[Organization]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

EXEC('CREATE TRIGGER [dbo].[TR_AuditLog_Immutable]
ON [dbo].[AuditLog]
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 51001, ''Los registros de auditoría son inmutables.'', 1;
END');

EXEC('CREATE TRIGGER [dbo].[TR_RegulationEvent_Immutable]
ON [dbo].[RegulationEvent]
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 51002, ''El historial regulatorio es inmutable.'', 1;
END');
