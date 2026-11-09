-- Patch 09: mensalidades SaaS administrativas e suspensão automática.
CREATE TYPE "TenantSuspensionReason" AS ENUM ('MANUAL', 'BILLING');
CREATE TYPE "MonthlyFeeStatus" AS ENUM ('PENDING', 'PAID');
CREATE TYPE "BillingAuditAction" AS ENUM ('CONFIG_UPDATED', 'COMPETENCY_CREATED', 'PAYMENT_CONFIRMED', 'AUTO_SUSPENDED', 'AUTO_REACTIVATED');

ALTER TABLE "Tenant"
  ADD COLUMN "monthlyFeeCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "billingStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "suspensionReason" "TenantSuspensionReason";

-- A data de cadastro representa o início contratual dos estabelecimentos já existentes.
UPDATE "Tenant" SET "billingStartedAt" = "createdAt";

CREATE TABLE "MonthlyFee" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "competence" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueOn" TEXT NOT NULL,
    "overdueAt" TIMESTAMP(3) NOT NULL,
    "status" "MonthlyFeeStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "confirmedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonthlyFee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingAudit" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "monthlyFeeId" UUID,
    "actorUserId" UUID,
    "action" "BillingAuditAction" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlyFee_tenantId_competence_key" ON "MonthlyFee"("tenantId", "competence");
CREATE INDEX "MonthlyFee_tenantId_status_overdueAt_idx" ON "MonthlyFee"("tenantId", "status", "overdueAt");
CREATE INDEX "BillingAudit_tenantId_createdAt_idx" ON "BillingAudit"("tenantId", "createdAt");
CREATE INDEX "BillingAudit_monthlyFeeId_createdAt_idx" ON "BillingAudit"("monthlyFeeId", "createdAt");

ALTER TABLE "MonthlyFee" ADD CONSTRAINT "MonthlyFee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyFee" ADD CONSTRAINT "MonthlyFee_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingAudit" ADD CONSTRAINT "BillingAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingAudit" ADD CONSTRAINT "BillingAudit_monthlyFeeId_fkey" FOREIGN KEY ("monthlyFeeId") REFERENCES "MonthlyFee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingAudit" ADD CONSTRAINT "BillingAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_monthly_fee_non_negative" CHECK ("monthlyFeeCents" >= 0);
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_billing_due_day_range" CHECK ("billingDueDay" BETWEEN 1 AND 31);
ALTER TABLE "MonthlyFee" ADD CONSTRAINT "MonthlyFee_positive_amount" CHECK ("amountCents" > 0);
ALTER TABLE "MonthlyFee" ADD CONSTRAINT "MonthlyFee_competence_format" CHECK ("competence" ~ '^[0-9]{4}-[0-9]{2}$');
ALTER TABLE "MonthlyFee" ADD CONSTRAINT "MonthlyFee_due_on_format" CHECK ("dueOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
