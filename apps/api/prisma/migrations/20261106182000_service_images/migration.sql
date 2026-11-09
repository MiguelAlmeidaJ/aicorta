ALTER TABLE "Service"
ADD COLUMN "image" BYTEA,
ADD COLUMN "imageMime" TEXT;

-- Serviços antigos sem profissional ficam sob responsabilidade do proprietário.
INSERT INTO "EmployeeService" ("membershipId", "serviceId")
SELECT owner_membership."id", service."id"
FROM "Service" service
JOIN "Tenant" tenant ON tenant."id" = service."tenantId"
JOIN "Membership" owner_membership
  ON owner_membership."tenantId" = tenant."id"
 AND owner_membership."userId" = tenant."ownerId"
 AND owner_membership."isActive" = TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM "EmployeeService" assigned WHERE assigned."serviceId" = service."id"
)
ON CONFLICT DO NOTHING;
