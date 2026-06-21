-- DropForeignKey
ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_blogId_fkey";

-- DropForeignKey
ALTER TABLE "brand_themes" DROP CONSTRAINT "brand_themes_blogId_fkey";

-- DropForeignKey
ALTER TABLE "pages" DROP CONSTRAINT "pages_blogId_fkey";

-- DropIndex
DROP INDEX "blog_posts_blogId_idx";

-- DropIndex
DROP INDEX "blog_posts_slug_key";

-- DropIndex
DROP INDEX "blog_posts_status_publishedAt_idx";

-- DropIndex
DROP INDEX "brand_themes_blogId_idx";

-- DropIndex
DROP INDEX "brand_themes_slug_key";

-- DropIndex
DROP INDEX "pages_blogId_idx";

-- DropIndex
DROP INDEX "pages_slug_key";

-- AlterTable
ALTER TABLE "blog_posts" ALTER COLUMN "blogId" SET NOT NULL;

-- AlterTable
ALTER TABLE "brand_themes" ALTER COLUMN "blogId" SET NOT NULL;

-- AlterTable
ALTER TABLE "pages" ALTER COLUMN "blogId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "blog_posts_blogId_status_publishedAt_idx" ON "blog_posts"("blogId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_blogId_slug_key" ON "blog_posts"("blogId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "brand_themes_blogId_slug_key" ON "brand_themes"("blogId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "pages_blogId_slug_key" ON "pages"("blogId", "slug");

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_themes" ADD CONSTRAINT "brand_themes_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
