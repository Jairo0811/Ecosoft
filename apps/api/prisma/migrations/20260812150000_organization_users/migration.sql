BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[User] ADD
    [authVersion] INT NOT NULL CONSTRAINT [User_authVersion_df] DEFAULT 0;

CREATE TABLE [dbo].[UserInvitation] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [email] NVARCHAR(320) NOT NULL,
    [tokenHash] CHAR(64) NOT NULL,
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [invitedByUserId] UNIQUEIDENTIFIER NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [acceptedAt] DATETIME2,
    [revokedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [UserInvitation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [UserInvitation_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UserInvitation_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

CREATE NONCLUSTERED INDEX [UserInvitation_userId_expiresAt_idx]
ON [dbo].[UserInvitation]([userId], [expiresAt]);

CREATE NONCLUSTERED INDEX [UserInvitation_invitedByUserId_createdAt_idx]
ON [dbo].[UserInvitation]([invitedByUserId], [createdAt]);

CREATE NONCLUSTERED INDEX [UserInvitation_email_createdAt_idx]
ON [dbo].[UserInvitation]([email], [createdAt]);

ALTER TABLE [dbo].[UserInvitation] ADD CONSTRAINT [UserInvitation_userId_fkey]
FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id])
ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE [dbo].[UserInvitation] ADD CONSTRAINT [UserInvitation_invitedByUserId_fkey]
FOREIGN KEY ([invitedByUserId]) REFERENCES [dbo].[User]([id])
ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
