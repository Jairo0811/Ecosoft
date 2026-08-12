BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[Organization] DROP CONSTRAINT [Organization_rnc_key];

ALTER TABLE [dbo].[Organization] ADD
    [contactName] NVARCHAR(200),
    [contactEmail] NVARCHAR(320),
    [contactPhone] VARCHAR(30),
    [website] NVARCHAR(500),
    [rejectionReason] NVARCHAR(1000),
    [reviewedAt] DATETIME2,
    [reviewedByUserId] UNIQUEIDENTIFIER;

CREATE UNIQUE NONCLUSTERED INDEX [Organization_rnc_key]
ON [dbo].[Organization]([rnc])
WHERE [rnc] IS NOT NULL;

CREATE NONCLUSTERED INDEX [Organization_reviewedByUserId_idx]
ON [dbo].[Organization]([reviewedByUserId]);

ALTER TABLE [dbo].[Organization] ADD CONSTRAINT [Organization_reviewedByUserId_fkey]
FOREIGN KEY ([reviewedByUserId]) REFERENCES [dbo].[User]([id])
ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE [dbo].[CatalogItem] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [type] VARCHAR(40) NOT NULL,
    [code] VARCHAR(60) NOT NULL,
    [name] NVARCHAR(160) NOT NULL,
    [description] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [CatalogItem_isActive_df] DEFAULT 1,
    [sortOrder] INT NOT NULL CONSTRAINT [CatalogItem_sortOrder_df] DEFAULT 0,
    [metadataJson] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CatalogItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CatalogItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CatalogItem_type_code_key] UNIQUE NONCLUSTERED ([type], [code])
);

CREATE NONCLUSTERED INDEX [CatalogItem_type_isActive_sortOrder_idx]
ON [dbo].[CatalogItem]([type], [isActive], [sortOrder]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
