-- AlterTable
ALTER TABLE "User" ADD COLUMN     "account_id" UUID;

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "auth_version" INTEGER NOT NULL DEFAULT 0,
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "account_id" UUID NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSession" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "auth_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSession" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_session_id" UUID NOT NULL,
    "refresh_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "TenantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountToken" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "binding_hash" TEXT,
    "pending_password_hash" TEXT,
    "pending_name" TEXT,
    "auth_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "AccountToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAuthAttempt" (
    "id" UUID NOT NULL,
    "state_hash" TEXT NOT NULL,
    "binding_hash" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "verifier_encrypted" TEXT NOT NULL,
    "link_session_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "GoogleAuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountInvitation" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invited_by" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "AccountInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_subject_key" ON "AuthIdentity"("provider", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_account_id_provider_key" ON "AuthIdentity"("account_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "AccountSession_token_hash_key" ON "AccountSession"("token_hash");

-- CreateIndex
CREATE INDEX "AccountSession_account_id_idx" ON "AccountSession"("account_id");

-- CreateIndex
CREATE INDEX "AccountSession_expires_at_idx" ON "AccountSession"("expires_at");

-- CreateIndex
CREATE INDEX "TenantSession_user_id_idx" ON "TenantSession"("user_id");

-- CreateIndex
CREATE INDEX "TenantSession_account_session_id_idx" ON "TenantSession"("account_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "AccountToken_token_hash_key" ON "AccountToken"("token_hash");

-- CreateIndex
CREATE INDEX "AccountToken_expires_at_idx" ON "AccountToken"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAuthAttempt_state_hash_key" ON "GoogleAuthAttempt"("state_hash");

-- CreateIndex
CREATE INDEX "GoogleAuthAttempt_expires_at_idx" ON "GoogleAuthAttempt"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "AccountInvitation_token_hash_key" ON "AccountInvitation"("token_hash");

-- CreateIndex
CREATE INDEX "AccountInvitation_organization_id_idx" ON "AccountInvitation"("organization_id");

-- CreateIndex
CREATE INDEX "AccountInvitation_expires_at_idx" ON "AccountInvitation"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "User_account_id_organization_id_key" ON "User"("account_id", "organization_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSession" ADD CONSTRAINT "AccountSession_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSession" ADD CONSTRAINT "TenantSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSession" ADD CONSTRAINT "TenantSession_account_session_id_fkey" FOREIGN KEY ("account_session_id") REFERENCES "AccountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountInvitation" ADD CONSTRAINT "AccountInvitation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountInvitation" ADD CONSTRAINT "AccountInvitation_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

