ALTER TABLE "User"
  ADD COLUMN "avatar" BYTEA,
  ADD COLUMN "avatarMime" TEXT;

CREATE TABLE "AppointmentService" (
  "appointmentId" UUID NOT NULL,
  "serviceId" UUID NOT NULL,
  CONSTRAINT "AppointmentService_pkey" PRIMARY KEY ("appointmentId", "serviceId"),
  CONSTRAINT "AppointmentService_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AppointmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "AppointmentService_serviceId_idx" ON "AppointmentService"("serviceId");

INSERT INTO "AppointmentService" ("appointmentId", "serviceId")
SELECT "id", "serviceId" FROM "Appointment";
