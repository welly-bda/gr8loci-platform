-- Create tenant-0 (gr8loci) if no blog exists yet.
INSERT INTO "blogs" ("id", "slug", "name", "status", "defaultLayout", "createdAt", "updatedAt")
SELECT 'blog_gr8loci_tenant0', 'gr8loci', 'GR8LOCI', 'active', 'default', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "blogs" WHERE "slug" = 'gr8loci');

-- Seed domains for tenant-0 (apex, www, and dev hosts), pre-verified.
INSERT INTO "domains" ("id", "hostname", "blogId", "isPrimary", "verifiedAt", "createdAt")
SELECT gen_random_uuid()::text, h.hostname, b.id, h.is_primary, NOW(), NOW()
FROM "blogs" b
CROSS JOIN (VALUES
  ('gr8loci.online', true),
  ('www.gr8loci.online', false),
  ('localhost', false),
  ('gr8loci.localhost', false)
) AS h(hostname, is_primary)
WHERE b."slug" = 'gr8loci'
  AND NOT EXISTS (SELECT 1 FROM "domains" d WHERE d."hostname" = h.hostname);

-- Backfill blogId on existing content to tenant-0.
UPDATE "blog_posts"  SET "blogId" = (SELECT id FROM "blogs" WHERE slug = 'gr8loci') WHERE "blogId" IS NULL;
UPDATE "pages"       SET "blogId" = (SELECT id FROM "blogs" WHERE slug = 'gr8loci') WHERE "blogId" IS NULL;
UPDATE "brand_themes" SET "blogId" = (SELECT id FROM "blogs" WHERE slug = 'gr8loci') WHERE "blogId" IS NULL;

-- Seed a super_admin membership for every existing admin user.
INSERT INTO "memberships" ("id", "userId", "blogId", "role", "createdAt")
SELECT gen_random_uuid()::text, u."id", b."id", 'super_admin', NOW()
FROM "admin_users" u
CROSS JOIN "blogs" b
WHERE b."slug" = 'gr8loci'
  AND NOT EXISTS (
    SELECT 1 FROM "memberships" m WHERE m."userId" = u."id" AND m."blogId" = b."id"
  );
