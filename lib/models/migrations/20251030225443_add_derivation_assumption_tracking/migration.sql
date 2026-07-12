-- CreateTable: DerivationAssumption
-- Purpose: Link derivations to assumptions they rely upon (per-derivation tracking)
-- Phase: Gap 4 - Per-Derivation Assumption Tracking

CREATE TABLE "DerivationAssumption" (
    "id" TEXT NOT NULL,
    "derivationId" TEXT NOT NULL,
    "assumptionId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "inferredFrom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DerivationAssumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint for derivation-assumption pair
CREATE UNIQUE INDEX "DerivationAssumption_derivationId_assumptionId_key" ON "DerivationAssumption"("derivationId", "assumptionId");

-- CreateIndex: Fast lookup by derivation
CREATE INDEX "DerivationAssumption_derivationId_idx" ON "DerivationAssumption"("derivationId");

-- CreateIndex: Fast lookup by assumption (reverse query)
CREATE INDEX "DerivationAssumption_assumptionId_idx" ON "DerivationAssumption"("assumptionId");

-- CreateIndex: Fast transitive assumption tracking
CREATE INDEX "DerivationAssumption_inferredFrom_idx" ON "DerivationAssumption"("inferredFrom");
