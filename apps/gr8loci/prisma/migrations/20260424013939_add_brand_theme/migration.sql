-- CreateTable
CREATE TABLE "brand_themes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tokens" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_themes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_themes_slug_key" ON "brand_themes"("slug");
