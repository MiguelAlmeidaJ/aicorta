-- Corrige divergência histórica: o schema já expunha tenantId em AppointmentService.
ALTER TABLE "AppointmentService" ADD COLUMN "tenantId" UUID;

UPDATE "AppointmentService" AS item
SET "tenantId" = appointment."tenantId"
FROM "Appointment" AS appointment
WHERE appointment."id" = item."appointmentId";

CREATE INDEX "AppointmentService_tenantId_idx" ON "AppointmentService"("tenantId");
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
