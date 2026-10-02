-- Phase A Bunpou catalog. Source fixtures live in src/bunpou-data and are
-- imported by npm run seed:bunpou. Retired rows are retained because future
-- comparisons, reports, question links, and SRS cards may reference them.

CREATE TYPE "BunpouKind" AS ENUM ('PATTERN', 'PARTICLE', 'CONJUGATION', 'FOUNDATION');

CREATE TABLE "BunpouPoint" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "level" "JlptLevel" NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" "BunpouKind" NOT NULL,
    "sectionKey" VARCHAR(80) NOT NULL,
    "family" VARCHAR(80),
    "title" VARCHAR(240) NOT NULL,
    "titlePlain" VARCHAR(160) NOT NULL,
    "titleReading" VARCHAR(240) NOT NULL,
    "titleRomaji" VARCHAR(240) NOT NULL,
    "meaningId" VARCHAR(240) NOT NULL,
    "meaningEn" VARCHAR(240) NOT NULL,
    "searchText" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "tags" TEXT[],
    "source" JSONB NOT NULL,
    "extract" JSONB NOT NULL,
    "review" JSONB,
    "aiModel" VARCHAR(120) NOT NULL,
    "promptVersion" VARCHAR(60) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BunpouPoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BunpouComparison" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" JSONB NOT NULL,
    "aiModel" VARCHAR(120) NOT NULL,
    "promptVersion" VARCHAR(60) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BunpouComparison_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BunpouComparisonPoint" (
    "comparisonId" INTEGER NOT NULL,
    "pointId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "BunpouComparisonPoint_pkey" PRIMARY KEY ("comparisonId", "pointId")
);

CREATE UNIQUE INDEX "BunpouPoint_key_key" ON "BunpouPoint"("key");
CREATE UNIQUE INDEX "BunpouPoint_level_order_key" ON "BunpouPoint"("level", "order");
CREATE INDEX "BunpouPoint_level_sectionKey_order_idx" ON "BunpouPoint"("level", "sectionKey", "order");
CREATE INDEX "BunpouPoint_family_idx" ON "BunpouPoint"("family");
CREATE INDEX "BunpouPoint_tags_idx" ON "BunpouPoint" USING GIN ("tags");

CREATE UNIQUE INDEX "BunpouComparison_key_key" ON "BunpouComparison"("key");
CREATE UNIQUE INDEX "BunpouComparisonPoint_comparisonId_order_key"
    ON "BunpouComparisonPoint"("comparisonId", "order");
CREATE INDEX "BunpouComparisonPoint_pointId_idx" ON "BunpouComparisonPoint"("pointId");

ALTER TABLE "BunpouComparisonPoint"
    ADD CONSTRAINT "BunpouComparisonPoint_comparisonId_fkey"
    FOREIGN KEY ("comparisonId") REFERENCES "BunpouComparison"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BunpouComparisonPoint"
    ADD CONSTRAINT "BunpouComparisonPoint_pointId_fkey"
    FOREIGN KEY ("pointId") REFERENCES "BunpouPoint"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Application tables are not exposed through the Supabase Data API. Prisma
-- connects server-side; RLS remains enabled as defense in depth without client
-- policies, matching the rest of this project.
REVOKE ALL PRIVILEGES ON TABLE "BunpouPoint" FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE "BunpouComparison" FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE "BunpouComparisonPoint" FROM anon, authenticated, service_role;
ALTER TABLE "BunpouPoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BunpouComparison" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BunpouComparisonPoint" ENABLE ROW LEVEL SECURITY;
