ALTER TABLE "PlatformBrand"
  ADD COLUMN "defaultTenantCover" BYTEA,
  ADD COLUMN "defaultTenantCoverMime" TEXT,
  ADD COLUMN "defaultServiceImage" BYTEA,
  ADD COLUMN "defaultServiceImageMime" TEXT,
  ADD COLUMN "defaultProfileImage" BYTEA,
  ADD COLUMN "defaultProfileImageMime" TEXT;
