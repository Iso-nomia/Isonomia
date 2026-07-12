-- Migration: add_ludics_generative_substrate
-- Generated: 2026-05-20
-- Applied via: prisma db push (project convention — migrate dev not used due to
--              incomplete shadow-DB migration history)
-- Status: ALREADY APPLIED to main DB (db push confirmed schema in sync 2026-05-20)
--
-- This SQL artifact documents what was pushed. Use it to apply to staging/prod
-- databases that cannot use `db push` (e.g. locked-down Supabase projects or
-- CI-gated environments):
--
--   psql $STAGING_DATABASE_URL < prisma/migrations/add_ludics_generative_substrate.sql

-- ─── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE "public"."LudicMove" (
    "id" TEXT NOT NULL,
    "deliberationId" TEXT NOT NULL,
    "locus" TEXT NOT NULL,
    "moveType" TEXT NOT NULL,
    "stratumLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "designId" TEXT,

    CONSTRAINT "LudicMove_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."WitnessRecord" (
    "id" TEXT NOT NULL,
    "ludicMoveId" TEXT NOT NULL,
    "dialogueMoveId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "canonicalText" TEXT NOT NULL,
    "schemeKey" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fossilizedAt" TIMESTAMP(3),
    "retractReason" TEXT,

    CONSTRAINT "WitnessRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Design" (
    "id" TEXT NOT NULL,
    "behaviourId" TEXT NOT NULL,
    "deliberationId" TEXT NOT NULL,
    "loci" TEXT[],
    "premiseClaimIds" TEXT[],
    "biorthoClass" TEXT NOT NULL,
    "derivedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Behaviour" (
    "id" TEXT NOT NULL,
    "deliberationId" TEXT NOT NULL,
    "rootLocus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Behaviour_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."DesignInclusion" (
    "id" TEXT NOT NULL,
    "smallerId" TEXT NOT NULL,
    "largerId" TEXT NOT NULL,

    CONSTRAINT "DesignInclusion_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX "LudicMove_deliberationId_stratumLabel_idx" ON "public"."LudicMove"("deliberationId", "stratumLabel");
CREATE UNIQUE INDEX "LudicMove_deliberationId_locus_key" ON "public"."LudicMove"("deliberationId", "locus");

CREATE UNIQUE INDEX "WitnessRecord_dialogueMoveId_key" ON "public"."WitnessRecord"("dialogueMoveId");
CREATE INDEX "WitnessRecord_ludicMoveId_idx" ON "public"."WitnessRecord"("ludicMoveId");
CREATE INDEX "WitnessRecord_participantId_idx" ON "public"."WitnessRecord"("participantId");
CREATE INDEX "WitnessRecord_fossilizedAt_idx" ON "public"."WitnessRecord"("fossilizedAt");

CREATE INDEX "Design_behaviourId_idx" ON "public"."Design"("behaviourId");
CREATE INDEX "Design_biorthoClass_idx" ON "public"."Design"("biorthoClass");
CREATE INDEX "Design_deliberationId_idx" ON "public"."Design"("deliberationId");

CREATE INDEX "Behaviour_deliberationId_idx" ON "public"."Behaviour"("deliberationId");
CREATE UNIQUE INDEX "Behaviour_deliberationId_rootLocus_key" ON "public"."Behaviour"("deliberationId", "rootLocus");

CREATE INDEX "DesignInclusion_smallerId_idx" ON "public"."DesignInclusion"("smallerId");
CREATE INDEX "DesignInclusion_largerId_idx" ON "public"."DesignInclusion"("largerId");
CREATE UNIQUE INDEX "DesignInclusion_smallerId_largerId_key" ON "public"."DesignInclusion"("smallerId", "largerId");

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────

ALTER TABLE "public"."LudicMove" ADD CONSTRAINT "LudicMove_deliberationId_fkey"
    FOREIGN KEY ("deliberationId") REFERENCES "public"."Deliberation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."LudicMove" ADD CONSTRAINT "LudicMove_designId_fkey"
    FOREIGN KEY ("designId") REFERENCES "public"."Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WitnessRecord" ADD CONSTRAINT "WitnessRecord_ludicMoveId_fkey"
    FOREIGN KEY ("ludicMoveId") REFERENCES "public"."LudicMove"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."Design" ADD CONSTRAINT "Design_behaviourId_fkey"
    FOREIGN KEY ("behaviourId") REFERENCES "public"."Behaviour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."DesignInclusion" ADD CONSTRAINT "DesignInclusion_smallerId_fkey"
    FOREIGN KEY ("smallerId") REFERENCES "public"."Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."DesignInclusion" ADD CONSTRAINT "DesignInclusion_largerId_fkey"
    FOREIGN KEY ("largerId") REFERENCES "public"."Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
