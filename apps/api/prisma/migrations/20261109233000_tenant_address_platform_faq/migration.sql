ALTER TABLE "Tenant"
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "street" TEXT,
  ADD COLUMN "streetNumber" TEXT,
  ADD COLUMN "complement" TEXT,
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION;

CREATE TABLE "PlatformFaq" (
  "id" UUID NOT NULL,
  "question" VARCHAR(220) NOT NULL,
  "answer" VARCHAR(3000) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformFaq_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformFaq_isActive_position_idx" ON "PlatformFaq"("isActive","position");
