-- CreateTable
CREATE TABLE "PlatformBrand" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "name" TEXT NOT NULL DEFAULT 'AICorta',
    "black" TEXT NOT NULL DEFAULT '#000000',
    "navy" TEXT NOT NULL DEFAULT '#050A30',
    "gold" TEXT NOT NULL DEFAULT '#F2C225',
    "silver" TEXT NOT NULL DEFAULT '#D9D9D9',
    "logo" BYTEA,
    "logoMime" TEXT,
    "darkLogo" BYTEA,
    "darkLogoMime" TEXT,
    "favicon" BYTEA,
    "faviconMime" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformBrand_pkey" PRIMARY KEY ("id")
);
