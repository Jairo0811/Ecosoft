BEGIN TRY

BEGIN TRAN;

CREATE TABLE [dbo].[Auction] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] VARCHAR(40) NOT NULL,
    [title] NVARCHAR(240) NOT NULL,
    [description] NVARCHAR(MAX),
    [status] VARCHAR(30) NOT NULL CONSTRAINT [Auction_status_df] DEFAULT 'BORRADOR',
    [managingOrganizationId] UNIQUEIDENTIFIER NOT NULL,
    [createdByUserId] UNIQUEIDENTIFIER NOT NULL,
    [renewableTechnologyCode] VARCHAR(60) NOT NULL,
    [currencyCode] VARCHAR(10) NOT NULL,
    [capacityMw] DECIMAL(18,3) NOT NULL,
    [maximumPrice] DECIMAL(18,4),
    [timezone] VARCHAR(80) NOT NULL CONSTRAINT [Auction_timezone_df] DEFAULT 'America/Santo_Domingo',
    [openAt] DATETIME2 NOT NULL,
    [closeAt] DATETIME2 NOT NULL,
    [evaluationStartAt] DATETIME2,
    [awardPlannedAt] DATETIME2,
    [publishedAt] DATETIME2,
    [closedAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [finalizedAt] DATETIME2,
    [cancellationReason] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Auction_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Auction_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Auction_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [Auction_capacity_positive] CHECK ([capacityMw] > 0),
    CONSTRAINT [Auction_maximum_price_positive] CHECK ([maximumPrice] IS NULL OR [maximumPrice] > 0),
    CONSTRAINT [Auction_dates_ordered] CHECK ([closeAt] > [openAt])
);

CREATE TABLE [dbo].[AuctionRequirement] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [auctionId] UNIQUEIDENTIFIER NOT NULL,
    [code] VARCHAR(60) NOT NULL,
    [title] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(1000),
    [category] VARCHAR(40) NOT NULL,
    [isMandatory] BIT NOT NULL CONSTRAINT [AuctionRequirement_isMandatory_df] DEFAULT 1,
    [sortOrder] INT NOT NULL CONSTRAINT [AuctionRequirement_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuctionRequirement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AuctionRequirement_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AuctionRequirement_auctionId_code_key] UNIQUE NONCLUSTERED ([auctionId], [code])
);

CREATE TABLE [dbo].[AuctionParticipant] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [auctionId] UNIQUEIDENTIFIER NOT NULL,
    [organizationId] UNIQUEIDENTIFIER NOT NULL,
    [status] VARCHAR(30) NOT NULL CONSTRAINT [AuctionParticipant_status_df] DEFAULT 'HABILITADO',
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuctionParticipant_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AuctionParticipant_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AuctionParticipant_auctionId_organizationId_key] UNIQUE NONCLUSTERED ([auctionId], [organizationId])
);

CREATE TABLE [dbo].[AuctionEvent] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [auctionId] UNIQUEIDENTIFIER NOT NULL,
    [createdByUserId] UNIQUEIDENTIFIER NOT NULL,
    [type] VARCHAR(40) NOT NULL,
    [previousStatus] VARCHAR(30),
    [newStatus] VARCHAR(30),
    [message] NVARCHAR(1000),
    [metadataJson] NVARCHAR(MAX),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuctionEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuctionEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[CalendarEvent] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [auctionId] UNIQUEIDENTIFIER,
    [createdByUserId] UNIQUEIDENTIFIER NOT NULL,
    [type] VARCHAR(40) NOT NULL,
    [source] VARCHAR(20) NOT NULL CONSTRAINT [CalendarEvent_source_df] DEFAULT 'MANUAL',
    [title] NVARCHAR(240) NOT NULL,
    [description] NVARCHAR(1000),
    [startsAt] DATETIME2 NOT NULL,
    [endsAt] DATETIME2,
    [allDay] BIT NOT NULL CONSTRAINT [CalendarEvent_allDay_df] DEFAULT 0,
    [location] NVARCHAR(300),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CalendarEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CalendarEvent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CalendarEvent_dates_ordered] CHECK ([endsAt] IS NULL OR [endsAt] >= [startsAt])
);

CREATE NONCLUSTERED INDEX [Auction_status_openAt_idx] ON [dbo].[Auction]([status], [openAt]);
CREATE NONCLUSTERED INDEX [Auction_managingOrganizationId_status_idx] ON [dbo].[Auction]([managingOrganizationId], [status]);
CREATE NONCLUSTERED INDEX [Auction_renewableTechnologyCode_status_idx] ON [dbo].[Auction]([renewableTechnologyCode], [status]);
CREATE NONCLUSTERED INDEX [AuctionRequirement_auctionId_category_sortOrder_idx] ON [dbo].[AuctionRequirement]([auctionId], [category], [sortOrder]);
CREATE NONCLUSTERED INDEX [AuctionParticipant_organizationId_status_idx] ON [dbo].[AuctionParticipant]([organizationId], [status]);
CREATE NONCLUSTERED INDEX [AuctionEvent_auctionId_createdAt_idx] ON [dbo].[AuctionEvent]([auctionId], [createdAt]);
CREATE NONCLUSTERED INDEX [CalendarEvent_startsAt_type_idx] ON [dbo].[CalendarEvent]([startsAt], [type]);
CREATE NONCLUSTERED INDEX [CalendarEvent_auctionId_source_idx] ON [dbo].[CalendarEvent]([auctionId], [source]);

ALTER TABLE [dbo].[Auction] ADD CONSTRAINT [Auction_managingOrganizationId_fkey]
FOREIGN KEY ([managingOrganizationId]) REFERENCES [dbo].[Organization]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Auction] ADD CONSTRAINT [Auction_createdByUserId_fkey]
FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AuctionRequirement] ADD CONSTRAINT [AuctionRequirement_auctionId_fkey]
FOREIGN KEY ([auctionId]) REFERENCES [dbo].[Auction]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AuctionParticipant] ADD CONSTRAINT [AuctionParticipant_auctionId_fkey]
FOREIGN KEY ([auctionId]) REFERENCES [dbo].[Auction]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AuctionParticipant] ADD CONSTRAINT [AuctionParticipant_organizationId_fkey]
FOREIGN KEY ([organizationId]) REFERENCES [dbo].[Organization]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AuctionEvent] ADD CONSTRAINT [AuctionEvent_auctionId_fkey]
FOREIGN KEY ([auctionId]) REFERENCES [dbo].[Auction]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AuctionEvent] ADD CONSTRAINT [AuctionEvent_createdByUserId_fkey]
FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[CalendarEvent] ADD CONSTRAINT [CalendarEvent_auctionId_fkey]
FOREIGN KEY ([auctionId]) REFERENCES [dbo].[Auction]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[CalendarEvent] ADD CONSTRAINT [CalendarEvent_createdByUserId_fkey]
FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0 ROLLBACK TRAN;
THROW
END CATCH
