-- Patch 07: atendimento, comandas e historico operacional.
CREATE TYPE "ServiceOrderStatus" AS ENUM ('CHECKED_IN', 'IN_PROGRESS', 'CLOSED', 'CANCELLED');
CREATE TYPE "ServiceOrderItemSource" AS ENUM ('APPOINTMENT', 'MANUAL');
CREATE TYPE "ServiceOrderEventType" AS ENUM ('CHECKED_IN', 'STARTED', 'ITEM_ADDED', 'ITEM_REMOVED', 'DISCOUNT_APPLIED', 'CLOSED', 'CANCELLED');

-- Preserve the name and price selected when a booking is created. Nullable
-- columns keep legacy bookings readable and are backfilled on first check-in.
ALTER TABLE "AppointmentService" ADD COLUMN "nameSnapshot" TEXT;
ALTER TABLE "AppointmentService" ADD COLUMN "priceCentsSnapshot" INTEGER;

CREATE TABLE "ServiceOrder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "employeeMembershipId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceOrderItem" (
    "id" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "serviceId" UUID,
    "source" "ServiceOrderItemSource" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceOrderEvent" (
    "id" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "type" "ServiceOrderEventType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceOrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceOrder_appointmentId_key" ON "ServiceOrder"("appointmentId");
CREATE UNIQUE INDEX "ServiceOrder_id_tenantId_key" ON "ServiceOrder"("id", "tenantId");
CREATE INDEX "ServiceOrder_tenantId_status_createdAt_idx" ON "ServiceOrder"("tenantId", "status", "createdAt");
CREATE INDEX "ServiceOrder_tenantId_clientId_createdAt_idx" ON "ServiceOrder"("tenantId", "clientId", "createdAt");
CREATE INDEX "ServiceOrder_tenantId_employeeMembershipId_createdAt_idx" ON "ServiceOrder"("tenantId", "employeeMembershipId", "createdAt");
CREATE INDEX "ServiceOrderItem_serviceOrderId_idx" ON "ServiceOrderItem"("serviceOrderId");
CREATE INDEX "ServiceOrderItem_tenantId_serviceId_idx" ON "ServiceOrderItem"("tenantId", "serviceId");
CREATE INDEX "ServiceOrderEvent_serviceOrderId_createdAt_idx" ON "ServiceOrderEvent"("serviceOrderId", "createdAt");
CREATE INDEX "ServiceOrderEvent_tenantId_createdAt_idx" ON "ServiceOrderEvent"("tenantId", "createdAt");

ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_employeeMembershipId_tenantId_fkey" FOREIGN KEY ("employeeMembershipId", "tenantId") REFERENCES "Membership"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderItem" ADD CONSTRAINT "ServiceOrderItem_serviceOrderId_tenantId_fkey" FOREIGN KEY ("serviceOrderId", "tenantId") REFERENCES "ServiceOrder"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderItem" ADD CONSTRAINT "ServiceOrderItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderEvent" ADD CONSTRAINT "ServiceOrderEvent_serviceOrderId_tenantId_fkey" FOREIGN KEY ("serviceOrderId", "tenantId") REFERENCES "ServiceOrder"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderEvent" ADD CONSTRAINT "ServiceOrderEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
