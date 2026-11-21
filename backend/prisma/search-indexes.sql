-- Trigram indexes so the app's search box (ILIKE '%text%') stops scanning every row.
-- Prisma can't declare these, so run once after `npm run db:push`:
--   psql "$DATABASE_URL" -f prisma/search-indexes.sql
-- CREATE EXTENSION needs a role allowed to do so; on a shared server ask the admin.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS crop_title_trgm    ON "Crop" USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS crop_category_trgm ON "Crop" USING gin (category gin_trgm_ops);
CREATE INDEX IF NOT EXISTS farm_name_trgm     ON "Farm" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS farm_district_trgm ON "Farm" USING gin (district gin_trgm_ops);
