ALTER TYPE "GlobalRole" ADD VALUE IF NOT EXISTS 'MANAGER';

CREATE TABLE "PlatformAudit" (
  "id" UUID NOT NULL,
  "actorUserId" UUID,
  "action" VARCHAR(64) NOT NULL,
  "targetType" VARCHAR(40) NOT NULL,
  "targetId" VARCHAR(100),
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformAudit_createdAt_idx" ON "PlatformAudit"("createdAt" DESC);
CREATE INDEX "PlatformAudit_actorUserId_createdAt_idx" ON "PlatformAudit"("actorUserId", "createdAt" DESC);
CREATE INDEX "PlatformAudit_targetType_targetId_idx" ON "PlatformAudit"("targetType", "targetId");
ALTER TABLE "PlatformAudit" ADD CONSTRAINT "PlatformAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
