-- Execute APÓS as migrations Prisma iniciais e após resolver conflitos preexistentes.
-- Defesa independente da API contra dois agendamentos ativos sobrepostos.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_professional_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "employeeMembershipId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING'::"AppointmentStatus", 'CONFIRMED'::"AppointmentStatus"));
ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_valid_time_span" CHECK ("endsAt" > "startsAt");
