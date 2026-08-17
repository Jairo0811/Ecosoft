BEGIN TRY
BEGIN TRAN;

CREATE TABLE [dbo].[Bid] (
  [id] UNIQUEIDENTIFIER NOT NULL,
  [auctionId] UNIQUEIDENTIFIER NOT NULL,
  [organizationId] UNIQUEIDENTIFIER NOT NULL,
  [createdByUserId] UNIQUEIDENTIFIER NOT NULL,
  [projectName] NVARCHAR(240) NOT NULL,
  [renewableTechnologyCode] VARCHAR(60) NOT NULL,
  [projectLocation] NVARCHAR(300),
  [offeredPowerMw] DECIMAL(18,3) NOT NULL,
  [estimatedEnergyMwh] DECIMAL(18,3) NOT NULL,
  [offeredPrice] DECIMAL(18,4) NOT NULL,
  [currencyCode] VARCHAR(10) NOT NULL,
  [validUntil] DATETIME2 NOT NULL,
  [status] VARCHAR(30) NOT NULL CONSTRAINT [Bid_status_df] DEFAULT 'BORRADOR',
  [submittedAt] DATETIME2,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [Bid_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [Bid_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [Bid_values_positive] CHECK ([offeredPowerMw] > 0 AND [estimatedEnergyMwh] > 0 AND [offeredPrice] > 0),
  CONSTRAINT [Bid_status_valid] CHECK ([status] IN ('BORRADOR','ENVIADA','RECIBIDA','EN_VALIDACION','VALIDADA','RECHAZADA','EN_EVALUACION','SELECCIONADA','NO_SELECCIONADA'))
);

CREATE TABLE [dbo].[Award] (
  [id] UNIQUEIDENTIFIER NOT NULL,
  [auctionId] UNIQUEIDENTIFIER NOT NULL,
  [bidId] UNIQUEIDENTIFIER NOT NULL,
  [resolutionNumber] VARCHAR(80) NOT NULL,
  [awardedPrice] DECIMAL(18,4) NOT NULL,
  [awardedCapacityMw] DECIMAL(18,3) NOT NULL,
  [justification] NVARCHAR(2000) NOT NULL,
  [status] VARCHAR(20) NOT NULL CONSTRAINT [Award_status_df] DEFAULT 'BORRADOR',
  [createdByUserId] UNIQUEIDENTIFIER NOT NULL,
  [approvedByUserId] UNIQUEIDENTIFIER,
  [approvedAt] DATETIME2,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [Award_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [Award_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [Award_bid_key] UNIQUE ([bidId]),
  CONSTRAINT [Award_auction_resolution_key] UNIQUE ([auctionId], [resolutionNumber]),
  CONSTRAINT [Award_values_positive] CHECK ([awardedPrice] > 0 AND [awardedCapacityMw] > 0),
  CONSTRAINT [Award_status_valid] CHECK ([status] IN ('BORRADOR','PENDIENTE_APROBACION','APROBADA','RECHAZADA'))
);

CREATE TABLE [dbo].[EnergyProject] (
  [id] UNIQUEIDENTIFIER NOT NULL,
  [organizationId] UNIQUEIDENTIFIER NOT NULL,
  [createdByUserId] UNIQUEIDENTIFIER NOT NULL,
  [name] NVARCHAR(240) NOT NULL,
  [renewableTechnologyCode] VARCHAR(60) NOT NULL,
  [province] NVARCHAR(120) NOT NULL,
  [municipality] NVARCHAR(120) NOT NULL,
  [installedCapacityMw] DECIMAL(18,3) NOT NULL,
  [contractedCapacityMw] DECIMAL(18,3) NOT NULL CONSTRAINT [EnergyProject_contracted_df] DEFAULT 0,
  [estimatedOperationDate] DATETIME2,
  [actualOperationDate] DATETIME2,
  [status] VARCHAR(30) NOT NULL CONSTRAINT [EnergyProject_status_df] DEFAULT 'PROPUESTO',
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [EnergyProject_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [EnergyProject_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [EnergyProject_capacity_valid] CHECK ([installedCapacityMw] > 0 AND [contractedCapacityMw] >= 0 AND [contractedCapacityMw] <= [installedCapacityMw]),
  CONSTRAINT [EnergyProject_status_valid] CHECK ([status] IN ('PROPUESTO','ADJUDICADO','EN_DESARROLLO','EN_CONSTRUCCION','OPERATIVO','SUSPENDIDO','FINALIZADO'))
);

CREATE TABLE [dbo].[PPAContract] (
  [id] UNIQUEIDENTIFIER NOT NULL,
  [contractNumber] VARCHAR(80) NOT NULL,
  [awardId] UNIQUEIDENTIFIER NOT NULL,
  [projectId] UNIQUEIDENTIFIER NOT NULL,
  [organizationId] UNIQUEIDENTIFIER NOT NULL,
  [createdByUserId] UNIQUEIDENTIFIER NOT NULL,
  [approvedByUserId] UNIQUEIDENTIFIER,
  [status] VARCHAR(30) NOT NULL CONSTRAINT [PPAContract_status_df] DEFAULT 'BORRADOR',
  [signatureDate] DATETIME2,
  [startDate] DATETIME2 NOT NULL,
  [endDate] DATETIME2 NOT NULL,
  [price] DECIMAL(18,4) NOT NULL,
  [currencyCode] VARCHAR(10) NOT NULL,
  [capacityMw] DECIMAL(18,3) NOT NULL,
  [committedEnergyMwh] DECIMAL(18,3) NOT NULL,
  [conditions] NVARCHAR(MAX),
  [approvedAt] DATETIME2,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [PPAContract_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [PPAContract_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [PPAContract_number_key] UNIQUE ([contractNumber]),
  CONSTRAINT [PPAContract_award_key] UNIQUE ([awardId]),
  CONSTRAINT [PPAContract_dates_valid] CHECK ([endDate] > [startDate]),
  CONSTRAINT [PPAContract_values_positive] CHECK ([price] > 0 AND [capacityMw] > 0 AND [committedEnergyMwh] > 0),
  CONSTRAINT [PPAContract_status_valid] CHECK ([status] IN ('BORRADOR','EN_REVISION','PENDIENTE_FIRMA','VIGENTE','SUSPENDIDO','VENCIDO','TERMINADO','CANCELADO'))
);

CREATE TABLE [dbo].[PPAContractVersion] (
  [id] UNIQUEIDENTIFIER NOT NULL,
  [contractId] UNIQUEIDENTIFIER NOT NULL,
  [versionNumber] INT NOT NULL,
  [snapshotJson] NVARCHAR(MAX) NOT NULL,
  [snapshotHash] CHAR(64) NOT NULL,
  [changeReason] NVARCHAR(1000) NOT NULL,
  [changedByUserId] UNIQUEIDENTIFIER NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [PPAContractVersion_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [PPAContractVersion_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [PPAContractVersion_contract_version_key] UNIQUE ([contractId], [versionNumber])
);

CREATE INDEX [Bid_auction_status_idx] ON [dbo].[Bid]([auctionId], [status]);
CREATE INDEX [Bid_organization_status_idx] ON [dbo].[Bid]([organizationId], [status]);
CREATE INDEX [Bid_technology_status_idx] ON [dbo].[Bid]([renewableTechnologyCode], [status]);
CREATE INDEX [Award_auction_status_idx] ON [dbo].[Award]([auctionId], [status]);
CREATE INDEX [EnergyProject_organization_status_idx] ON [dbo].[EnergyProject]([organizationId], [status]);
CREATE INDEX [EnergyProject_technology_status_idx] ON [dbo].[EnergyProject]([renewableTechnologyCode], [status]);
CREATE INDEX [EnergyProject_province_status_idx] ON [dbo].[EnergyProject]([province], [status]);
CREATE INDEX [PPAContract_organization_status_idx] ON [dbo].[PPAContract]([organizationId], [status]);
CREATE INDEX [PPAContract_end_status_idx] ON [dbo].[PPAContract]([endDate], [status]);

ALTER TABLE [dbo].[Bid] ADD
  CONSTRAINT [Bid_auction_fkey] FOREIGN KEY ([auctionId]) REFERENCES [dbo].[Auction]([id]),
  CONSTRAINT [Bid_organization_fkey] FOREIGN KEY ([organizationId]) REFERENCES [dbo].[Organization]([id]),
  CONSTRAINT [Bid_creator_fkey] FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([id]);
ALTER TABLE [dbo].[Award] ADD
  CONSTRAINT [Award_auction_fkey] FOREIGN KEY ([auctionId]) REFERENCES [dbo].[Auction]([id]),
  CONSTRAINT [Award_bid_fkey] FOREIGN KEY ([bidId]) REFERENCES [dbo].[Bid]([id]),
  CONSTRAINT [Award_creator_fkey] FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([id]),
  CONSTRAINT [Award_approver_fkey] FOREIGN KEY ([approvedByUserId]) REFERENCES [dbo].[User]([id]);
ALTER TABLE [dbo].[EnergyProject] ADD
  CONSTRAINT [EnergyProject_organization_fkey] FOREIGN KEY ([organizationId]) REFERENCES [dbo].[Organization]([id]),
  CONSTRAINT [EnergyProject_creator_fkey] FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([id]);
ALTER TABLE [dbo].[PPAContract] ADD
  CONSTRAINT [PPAContract_award_fkey] FOREIGN KEY ([awardId]) REFERENCES [dbo].[Award]([id]),
  CONSTRAINT [PPAContract_project_fkey] FOREIGN KEY ([projectId]) REFERENCES [dbo].[EnergyProject]([id]),
  CONSTRAINT [PPAContract_organization_fkey] FOREIGN KEY ([organizationId]) REFERENCES [dbo].[Organization]([id]),
  CONSTRAINT [PPAContract_creator_fkey] FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([id]),
  CONSTRAINT [PPAContract_approver_fkey] FOREIGN KEY ([approvedByUserId]) REFERENCES [dbo].[User]([id]);
ALTER TABLE [dbo].[PPAContractVersion] ADD
  CONSTRAINT [PPAContractVersion_contract_fkey] FOREIGN KEY ([contractId]) REFERENCES [dbo].[PPAContract]([id]),
  CONSTRAINT [PPAContractVersion_user_fkey] FOREIGN KEY ([changedByUserId]) REFERENCES [dbo].[User]([id]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH
