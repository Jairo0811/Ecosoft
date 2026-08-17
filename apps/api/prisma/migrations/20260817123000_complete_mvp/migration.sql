BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[Bid] ADD [withdrawnAt] DATETIME2 NULL;
ALTER TABLE [dbo].[Bid] ADD [submissionHash] CHAR(64) NULL;
ALTER TABLE [dbo].[Bid] DROP CONSTRAINT [Bid_status_valid];
UPDATE [dbo].[Bid] SET [status] = CASE
    WHEN [status] IN ('RECIBIDA', 'EN_VALIDACION', 'VALIDADA') THEN 'ENVIADA'
    WHEN [status] = 'RECHAZADA' THEN 'NO_SELECCIONADA'
    WHEN [status] = 'SELECCIONADA' THEN 'ADJUDICADA'
    ELSE [status]
END;
ALTER TABLE [dbo].[Bid] ADD CONSTRAINT [Bid_status_check]
CHECK ([status] IN ('BORRADOR', 'ENVIADA', 'RETIRADA', 'EN_EVALUACION', 'ADJUDICADA', 'NO_SELECCIONADA'));

ALTER TABLE [dbo].[Award] DROP CONSTRAINT [Award_status_valid];
UPDATE [dbo].[Award] SET [status] = 'BORRADOR' WHERE [status] = 'PENDIENTE_APROBACION';
ALTER TABLE [dbo].[Award] ADD CONSTRAINT [Award_status_check]
CHECK ([status] IN ('BORRADOR', 'APROBADA', 'RECHAZADA'));

ALTER TABLE [dbo].[EnergyProject] DROP CONSTRAINT [EnergyProject_status_valid];
UPDATE [dbo].[EnergyProject] SET [status] = 'EN_DESARROLLO' WHERE [status] = 'ADJUDICADO';
ALTER TABLE [dbo].[EnergyProject] ADD CONSTRAINT [EnergyProject_status_check]
CHECK ([status] IN ('PROPUESTO', 'EN_DESARROLLO', 'EN_CONSTRUCCION', 'OPERATIVO', 'SUSPENDIDO', 'FINALIZADO'));

ALTER TABLE [dbo].[PPAContract] DROP CONSTRAINT [PPAContract_status_valid];
UPDATE [dbo].[PPAContract] SET [status] = CASE
    WHEN [status] = 'EN_REVISION' THEN 'BORRADOR'
    WHEN [status] = 'TERMINADO' THEN 'VENCIDO'
    ELSE [status]
END;
ALTER TABLE [dbo].[PPAContract] ADD CONSTRAINT [PPAContract_status_check]
CHECK ([status] IN ('BORRADOR', 'PENDIENTE_FIRMA', 'VIGENTE', 'SUSPENDIDO', 'VENCIDO', 'CANCELADO'));

CREATE TABLE [dbo].[BidVersion] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [bidId] UNIQUEIDENTIFIER NOT NULL,
    [versionNumber] INT NOT NULL,
    [snapshotJson] NVARCHAR(MAX) NOT NULL,
    [snapshotHash] CHAR(64) NOT NULL,
    [changeReason] NVARCHAR(1000) NOT NULL,
    [changedByUserId] UNIQUEIDENTIFIER NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BidVersion_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [BidVersion_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE UNIQUE NONCLUSTERED INDEX [BidVersion_bidId_versionNumber_key]
ON [dbo].[BidVersion]([bidId], [versionNumber]);
CREATE NONCLUSTERED INDEX [BidVersion_bidId_createdAt_idx]
ON [dbo].[BidVersion]([bidId], [createdAt]);

CREATE TABLE [dbo].[Document] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [organizationId] UNIQUEIDENTIFIER NULL,
    [createdByUserId] UNIQUEIDENTIFIER NOT NULL,
    [entityType] VARCHAR(40) NOT NULL,
    [entityId] VARCHAR(100) NOT NULL,
    [documentType] VARCHAR(60) NOT NULL,
    [title] NVARCHAR(240) NOT NULL,
    [confidentiality] VARCHAR(20) NOT NULL CONSTRAINT [Document_confidentiality_df] DEFAULT 'PRIVATE',
    [status] VARCHAR(20) NOT NULL CONSTRAINT [Document_status_df] DEFAULT 'ACTIVE',
    [currentVersionNumber] INT NOT NULL CONSTRAINT [Document_currentVersionNumber_df] DEFAULT 1,
    [extractedText] NVARCHAR(MAX) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Document_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Document_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Document_entityType_check] CHECK ([entityType] IN ('AUCTION', 'BID', 'EVALUATION', 'AWARD', 'PPA_CONTRACT', 'ENERGY_PROJECT', 'REGULATION')),
    CONSTRAINT [Document_confidentiality_check] CHECK ([confidentiality] IN ('PRIVATE', 'INSTITUTIONAL')),
    CONSTRAINT [Document_status_check] CHECK ([status] IN ('ACTIVE', 'ARCHIVED'))
);
CREATE NONCLUSTERED INDEX [Document_entityType_entityId_status_idx]
ON [dbo].[Document]([entityType], [entityId], [status]);
CREATE NONCLUSTERED INDEX [Document_organizationId_confidentiality_idx]
ON [dbo].[Document]([organizationId], [confidentiality]);

CREATE TABLE [dbo].[DocumentVersion] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [documentId] UNIQUEIDENTIFIER NOT NULL,
    [versionNumber] INT NOT NULL,
    [storageKey] NVARCHAR(500) NOT NULL,
    [originalFileName] NVARCHAR(255) NOT NULL,
    [mimeType] VARCHAR(120) NOT NULL,
    [sizeBytes] INT NOT NULL,
    [sha256] CHAR(64) NOT NULL,
    [uploadedByUserId] UNIQUEIDENTIFIER NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DocumentVersion_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [DocumentVersion_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [DocumentVersion_size_check] CHECK ([sizeBytes] > 0)
);
CREATE UNIQUE NONCLUSTERED INDEX [DocumentVersion_documentId_versionNumber_key]
ON [dbo].[DocumentVersion]([documentId], [versionNumber]);
CREATE NONCLUSTERED INDEX [DocumentVersion_sha256_idx] ON [dbo].[DocumentVersion]([sha256]);

CREATE TABLE [dbo].[EvaluationMatrix] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [auctionId] UNIQUEIDENTIFIER NOT NULL,
    [versionNumber] INT NOT NULL,
    [name] NVARCHAR(240) NOT NULL,
    [status] VARCHAR(20) NOT NULL CONSTRAINT [EvaluationMatrix_status_df] DEFAULT 'BORRADOR',
    [createdByUserId] UNIQUEIDENTIFIER NOT NULL,
    [publishedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EvaluationMatrix_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EvaluationMatrix_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EvaluationMatrix_status_check] CHECK ([status] IN ('BORRADOR', 'PUBLICADA', 'ARCHIVADA'))
);
CREATE UNIQUE NONCLUSTERED INDEX [EvaluationMatrix_auctionId_versionNumber_key]
ON [dbo].[EvaluationMatrix]([auctionId], [versionNumber]);
CREATE NONCLUSTERED INDEX [EvaluationMatrix_auctionId_status_idx]
ON [dbo].[EvaluationMatrix]([auctionId], [status]);

CREATE TABLE [dbo].[EvaluationCriterion] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [matrixId] UNIQUEIDENTIFIER NOT NULL,
    [code] VARCHAR(60) NOT NULL,
    [title] NVARCHAR(240) NOT NULL,
    [description] NVARCHAR(1000) NULL,
    [type] VARCHAR(20) NOT NULL,
    [weight] DECIMAL(8,4) NOT NULL,
    [minimumScore] DECIMAL(8,3) NULL,
    [maximumScore] DECIMAL(8,3) NOT NULL,
    [sortOrder] INT NOT NULL CONSTRAINT [EvaluationCriterion_sortOrder_df] DEFAULT 0,
    CONSTRAINT [EvaluationCriterion_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EvaluationCriterion_type_check] CHECK ([type] IN ('TECNICA', 'FINANCIERA')),
    CONSTRAINT [EvaluationCriterion_weight_check] CHECK ([weight] > 0 AND [weight] <= 1),
    CONSTRAINT [EvaluationCriterion_score_check] CHECK ([maximumScore] > 0 AND ([minimumScore] IS NULL OR [minimumScore] >= 0 AND [minimumScore] <= [maximumScore]))
);
CREATE UNIQUE NONCLUSTERED INDEX [EvaluationCriterion_matrixId_code_key]
ON [dbo].[EvaluationCriterion]([matrixId], [code]);
CREATE NONCLUSTERED INDEX [EvaluationCriterion_matrixId_type_sortOrder_idx]
ON [dbo].[EvaluationCriterion]([matrixId], [type], [sortOrder]);

CREATE TABLE [dbo].[Evaluation] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [matrixId] UNIQUEIDENTIFIER NOT NULL,
    [bidId] UNIQUEIDENTIFIER NOT NULL,
    [evaluatorUserId] UNIQUEIDENTIFIER NOT NULL,
    [type] VARCHAR(20) NOT NULL,
    [status] VARCHAR(20) NOT NULL CONSTRAINT [Evaluation_status_df] DEFAULT 'BORRADOR',
    [totalScore] DECIMAL(10,4) NULL,
    [comments] NVARCHAR(2000) NULL,
    [submittedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Evaluation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Evaluation_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Evaluation_type_check] CHECK ([type] IN ('TECNICA', 'FINANCIERA')),
    CONSTRAINT [Evaluation_status_check] CHECK ([status] IN ('BORRADOR', 'ENVIADA'))
);
CREATE UNIQUE NONCLUSTERED INDEX [Evaluation_matrixId_bidId_evaluatorUserId_type_key]
ON [dbo].[Evaluation]([matrixId], [bidId], [evaluatorUserId], [type]);
CREATE NONCLUSTERED INDEX [Evaluation_bidId_type_status_idx]
ON [dbo].[Evaluation]([bidId], [type], [status]);

CREATE TABLE [dbo].[EvaluationScore] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [evaluationId] UNIQUEIDENTIFIER NOT NULL,
    [criterionId] UNIQUEIDENTIFIER NOT NULL,
    [score] DECIMAL(8,3) NOT NULL,
    [comments] NVARCHAR(1000) NULL,
    CONSTRAINT [EvaluationScore_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EvaluationScore_score_check] CHECK ([score] >= 0)
);
CREATE UNIQUE NONCLUSTERED INDEX [EvaluationScore_evaluationId_criterionId_key]
ON [dbo].[EvaluationScore]([evaluationId], [criterionId]);

CREATE TABLE [dbo].[EnergyProjectEvent] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [projectId] UNIQUEIDENTIFIER NOT NULL,
    [changedByUserId] UNIQUEIDENTIFIER NOT NULL,
    [previousStatus] VARCHAR(30) NULL,
    [newStatus] VARCHAR(30) NOT NULL,
    [reason] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EnergyProjectEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [EnergyProjectEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE NONCLUSTERED INDEX [EnergyProjectEvent_projectId_createdAt_idx]
ON [dbo].[EnergyProjectEvent]([projectId], [createdAt]);

CREATE TABLE [dbo].[PPAContractEvent] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [contractId] UNIQUEIDENTIFIER NOT NULL,
    [changedByUserId] UNIQUEIDENTIFIER NOT NULL,
    [previousStatus] VARCHAR(30) NULL,
    [newStatus] VARCHAR(30) NOT NULL,
    [reason] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PPAContractEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PPAContractEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE NONCLUSTERED INDEX [PPAContractEvent_contractId_createdAt_idx]
ON [dbo].[PPAContractEvent]([contractId], [createdAt]);

CREATE TABLE [dbo].[AIAnalysis] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [documentId] UNIQUEIDENTIFIER NULL,
    [organizationId] UNIQUEIDENTIFIER NULL,
    [requestedByUserId] UNIQUEIDENTIFIER NOT NULL,
    [reviewedByUserId] UNIQUEIDENTIFIER NULL,
    [operation] VARCHAR(40) NOT NULL,
    [status] VARCHAR(20) NOT NULL CONSTRAINT [AIAnalysis_status_df] DEFAULT 'COMPLETED',
    [provider] VARCHAR(60) NOT NULL,
    [inputHash] CHAR(64) NOT NULL,
    [sourceReferencesJson] NVARCHAR(MAX) NOT NULL,
    [resultJson] NVARCHAR(MAX) NOT NULL,
    [confidence] DECIMAL(5,4) NULL,
    [reviewDecision] VARCHAR(30) NULL,
    [reviewNotes] NVARCHAR(1000) NULL,
    [reviewedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AIAnalysis_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AIAnalysis_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AIAnalysis_operation_check] CHECK ([operation] IN ('OCR', 'SUMMARY', 'ANOMALY_REVIEW')),
    CONSTRAINT [AIAnalysis_status_check] CHECK ([status] IN ('COMPLETED', 'FAILED')),
    CONSTRAINT [AIAnalysis_review_check] CHECK ([reviewDecision] IS NULL OR [reviewDecision] IN ('ACCEPTED', 'REJECTED'))
);
CREATE NONCLUSTERED INDEX [AIAnalysis_organizationId_createdAt_idx]
ON [dbo].[AIAnalysis]([organizationId], [createdAt]);
CREATE NONCLUSTERED INDEX [AIAnalysis_documentId_operation_idx]
ON [dbo].[AIAnalysis]([documentId], [operation]);
CREATE NONCLUSTERED INDEX [AIAnalysis_status_reviewDecision_idx]
ON [dbo].[AIAnalysis]([status], [reviewDecision]);

ALTER TABLE [dbo].[BidVersion] ADD CONSTRAINT [BidVersion_bidId_fkey]
FOREIGN KEY ([bidId]) REFERENCES [dbo].[Bid]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[BidVersion] ADD CONSTRAINT [BidVersion_changedByUserId_fkey]
FOREIGN KEY ([changedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Document] ADD CONSTRAINT [Document_organizationId_fkey]
FOREIGN KEY ([organizationId]) REFERENCES [dbo].[Organization]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Document] ADD CONSTRAINT [Document_createdByUserId_fkey]
FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[DocumentVersion] ADD CONSTRAINT [DocumentVersion_documentId_fkey]
FOREIGN KEY ([documentId]) REFERENCES [dbo].[Document]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[DocumentVersion] ADD CONSTRAINT [DocumentVersion_uploadedByUserId_fkey]
FOREIGN KEY ([uploadedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EvaluationMatrix] ADD CONSTRAINT [EvaluationMatrix_auctionId_fkey]
FOREIGN KEY ([auctionId]) REFERENCES [dbo].[Auction]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EvaluationMatrix] ADD CONSTRAINT [EvaluationMatrix_createdByUserId_fkey]
FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EvaluationCriterion] ADD CONSTRAINT [EvaluationCriterion_matrixId_fkey]
FOREIGN KEY ([matrixId]) REFERENCES [dbo].[EvaluationMatrix]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Evaluation] ADD CONSTRAINT [Evaluation_matrixId_fkey]
FOREIGN KEY ([matrixId]) REFERENCES [dbo].[EvaluationMatrix]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Evaluation] ADD CONSTRAINT [Evaluation_bidId_fkey]
FOREIGN KEY ([bidId]) REFERENCES [dbo].[Bid]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Evaluation] ADD CONSTRAINT [Evaluation_evaluatorUserId_fkey]
FOREIGN KEY ([evaluatorUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EvaluationScore] ADD CONSTRAINT [EvaluationScore_evaluationId_fkey]
FOREIGN KEY ([evaluationId]) REFERENCES [dbo].[Evaluation]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EvaluationScore] ADD CONSTRAINT [EvaluationScore_criterionId_fkey]
FOREIGN KEY ([criterionId]) REFERENCES [dbo].[EvaluationCriterion]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EnergyProjectEvent] ADD CONSTRAINT [EnergyProjectEvent_projectId_fkey]
FOREIGN KEY ([projectId]) REFERENCES [dbo].[EnergyProject]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[EnergyProjectEvent] ADD CONSTRAINT [EnergyProjectEvent_changedByUserId_fkey]
FOREIGN KEY ([changedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PPAContractEvent] ADD CONSTRAINT [PPAContractEvent_contractId_fkey]
FOREIGN KEY ([contractId]) REFERENCES [dbo].[PPAContract]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PPAContractEvent] ADD CONSTRAINT [PPAContractEvent_changedByUserId_fkey]
FOREIGN KEY ([changedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AIAnalysis] ADD CONSTRAINT [AIAnalysis_documentId_fkey]
FOREIGN KEY ([documentId]) REFERENCES [dbo].[Document]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AIAnalysis] ADD CONSTRAINT [AIAnalysis_organizationId_fkey]
FOREIGN KEY ([organizationId]) REFERENCES [dbo].[Organization]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AIAnalysis] ADD CONSTRAINT [AIAnalysis_requestedByUserId_fkey]
FOREIGN KEY ([requestedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AIAnalysis] ADD CONSTRAINT [AIAnalysis_reviewedByUserId_fkey]
FOREIGN KEY ([reviewedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

EXEC('CREATE TRIGGER [dbo].[TR_BidVersion_Immutable] ON [dbo].[BidVersion]
AFTER UPDATE, DELETE AS BEGIN SET NOCOUNT ON; THROW 51010, ''Las versiones de ofertas son inmutables.'', 1; END');
EXEC('CREATE TRIGGER [dbo].[TR_DocumentVersion_Immutable] ON [dbo].[DocumentVersion]
AFTER UPDATE, DELETE AS BEGIN SET NOCOUNT ON; THROW 51011, ''Las versiones documentales son inmutables.'', 1; END');
EXEC('CREATE TRIGGER [dbo].[TR_PPAContractVersion_Immutable] ON [dbo].[PPAContractVersion]
AFTER UPDATE, DELETE AS BEGIN SET NOCOUNT ON; THROW 51012, ''Las versiones contractuales son inmutables.'', 1; END');
EXEC('CREATE TRIGGER [dbo].[TR_EnergyProjectEvent_Immutable] ON [dbo].[EnergyProjectEvent]
AFTER UPDATE, DELETE AS BEGIN SET NOCOUNT ON; THROW 51013, ''El historial de proyectos es inmutable.'', 1; END');
EXEC('CREATE TRIGGER [dbo].[TR_PPAContractEvent_Immutable] ON [dbo].[PPAContractEvent]
AFTER UPDATE, DELETE AS BEGIN SET NOCOUNT ON; THROW 51014, ''El historial contractual es inmutable.'', 1; END');

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
