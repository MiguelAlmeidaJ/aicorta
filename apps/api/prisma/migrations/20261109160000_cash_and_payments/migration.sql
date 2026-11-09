-- Patch 08: caixa, pagamentos divididos e movimentos financeiros auditaveis.
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "CashMovementType" AS ENUM ('OPENING_BALANCE', 'PAYMENT', 'WITHDRAWAL', 'SUPPLY', 'REFUND');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'OTHER');
CREATE TYPE "PaymentStatus" AS ENUM ('CONFIRMED', 'VOIDED');

CREATE TABLE "CashSession" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "openedById" UUID NOT NULL,
    "closedById" UUID,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingBalanceCents" INTEGER NOT NULL,
    "expectedBalanceCents" INTEGER NOT NULL,
    "countedBalanceCents" INTEGER,
    "differenceCents" INTEGER,
    "openingNotes" TEXT,
    "closingNotes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "cashSessionId" UUID NOT NULL,
    "receivedById" UUID NOT NULL,
    "voidedById" UUID,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "amountCents" INTEGER NOT NULL,
    "reference" TEXT,
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashMovement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cashSessionId" UUID NOT NULL,
    "paymentId" UUID,
    "actorUserId" UUID NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashSession_id_tenantId_key" ON "CashSession"("id", "tenantId");
CREATE UNIQUE INDEX "cash_session_one_open_per_tenant" ON "CashSession"("tenantId") WHERE "status" = 'OPEN';
CREATE INDEX "CashSession_tenantId_status_openedAt_idx" ON "CashSession"("tenantId", "status", "openedAt");
CREATE UNIQUE INDEX "Payment_id_tenantId_key" ON "Payment"("id", "tenantId");
CREATE INDEX "Payment_tenantId_serviceOrderId_status_idx" ON "Payment"("tenantId", "serviceOrderId", "status");
CREATE INDEX "Payment_tenantId_cashSessionId_createdAt_idx" ON "Payment"("tenantId", "cashSessionId", "createdAt");
CREATE INDEX "CashMovement_cashSessionId_createdAt_idx" ON "CashMovement"("cashSessionId", "createdAt");
CREATE INDEX "CashMovement_tenantId_type_createdAt_idx" ON "CashMovement"("tenantId", "type", "createdAt");
CREATE INDEX "CashMovement_paymentId_idx" ON "CashMovement"("paymentId");

ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_serviceOrderId_tenantId_fkey" FOREIGN KEY ("serviceOrderId", "tenantId") REFERENCES "ServiceOrder"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashSessionId_tenantId_fkey" FOREIGN KEY ("cashSessionId", "tenantId") REFERENCES "CashSession"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashSessionId_tenantId_fkey" FOREIGN KEY ("cashSessionId", "tenantId") REFERENCES "CashSession"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_paymentId_tenantId_fkey" FOREIGN KEY ("paymentId", "tenantId") REFERENCES "Payment"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_non_negative_balances" CHECK (
  "openingBalanceCents" >= 0 AND "expectedBalanceCents" >= 0 AND
  ("countedBalanceCents" IS NULL OR "countedBalanceCents" >= 0)
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount" CHECK ("amountCents" > 0);
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_positive_amount" CHECK ("amountCents" > 0);
