-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "billingDueDay" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "OwnerInvite" (
    "id" UUID NOT NULL,
    "issuedById" UUID NOT NULL,
    "referenceName" TEXT NOT NULL,
    "billingDueDay" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerInvite_tokenHash_key" ON "OwnerInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "OwnerInvite_expiresAt_idx" ON "OwnerInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "OwnerInvite_issuedById_createdAt_idx" ON "OwnerInvite"("issuedById", "createdAt");

-- AddForeignKey
ALTER TABLE "OwnerInvite" ADD CONSTRAINT "OwnerInvite_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
