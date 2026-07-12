/**
 * lib/schemes/provenanceTools.ts
 *
 * Roadmap Phase D (SCHEMES_MCP_ALIGNMENT_ROADMAP §4) — scheme provenance read
 * surface over the shipped Q-022 (per-scheme provenance) and Q-024
 * (chronological audit) columns. Two read operations shared by the HTTP routes
 * that back the MCP tools:
 *
 *   D.1 getSchemeProvenanceByKey       → get_scheme_provenance
 *   D.2 compareSchemeProvenanceByKeys  → compare_scheme_provenance  (D.1 + C.1)
 *
 * Every field echoes a shipped column verbatim — no derivation, no truth
 * manufacture. D.2 composes the two provenance reads with the verifier
 * (`verifySchemeEqualityByKey`) so the "same scheme under two presentations?"
 * diagnostic carries both the source delta and the behaviour-equality signal,
 * keeping the necessary-but-not-sufficient fingerprint framing explicit.
 */

import { prisma as defaultPrisma } from "@/lib/prismaclient";
import type { Prisma, PrismaClient } from "@prisma/client";
import { verifySchemeEqualityByKey } from "@/lib/schemes/readTools";
import type { VerifierVerdict, VerifierOptions } from "@/lib/schemes/verifier";

type Tx = PrismaClient | Prisma.TransactionClient;

export type SchemeProvenance = {
  /** Upstream catalogue of record (CHECK-constrained enum; default "admin-authored"). */
  sourceCatalogue: string;
  /** External catalogue id, when imported. */
  sourceId: string | null;
  /** External catalogue version string, when imported. */
  sourceVersion: string | null;
  /** ISO timestamp of import, when imported. */
  importedAt: string | null;
  /** Importer tool version, when imported. */
  importerVersion: string | null;
  /** Auth id of the creator; NULL for pre-Q024 migrated rows. */
  createdBy: string | null;
  /** ISO creation timestamp (migration moment for pre-Q024 rows). */
  createdAt: string | null;
};

export type GetSchemeProvenanceResult =
  | { error: "scheme-not-found"; missingKeys: string[] }
  | ({ schemeKey: string } & SchemeProvenance);

/**
 * D.1 — echo the shipped provenance + audit columns for a scheme addressed by
 * key. No derivation: every field is a column read.
 */
export async function getSchemeProvenanceByKey(
  key: string,
  tx: Tx = defaultPrisma,
): Promise<GetSchemeProvenanceResult> {
  const row = (await tx.argumentScheme.findUnique({
    where: { key },
    select: {
      sourceCatalogue: true,
      sourceId: true,
      sourceVersion: true,
      importedAt: true,
      importerVersion: true,
      createdBy: true,
      createdAt: true,
    } as any,
  })) as
    | {
        sourceCatalogue: string;
        sourceId: string | null;
        sourceVersion: string | null;
        importedAt: Date | null;
        importerVersion: string | null;
        createdBy: string | null;
        createdAt: Date | null;
      }
    | null;

  if (!row) return { error: "scheme-not-found", missingKeys: [key] };

  return {
    schemeKey: key,
    sourceCatalogue: row.sourceCatalogue,
    sourceId: row.sourceId ?? null,
    sourceVersion: row.sourceVersion ?? null,
    importedAt: row.importedAt ? row.importedAt.toISOString() : null,
    importerVersion: row.importerVersion ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  };
}

/** Per-field provenance delta between two schemes (null when both sides match). */
export type ProvenanceDelta = {
  [K in keyof SchemeProvenance]: { a: SchemeProvenance[K]; b: SchemeProvenance[K] } | null;
};

export type CompareSchemeProvenanceResult =
  | { error: "scheme-not-found"; missingKeys: string[] }
  | {
      keyA: string;
      keyB: string;
      provenanceA: SchemeProvenance;
      provenanceB: SchemeProvenance;
      /** True iff both rows share the same `sourceCatalogue` + `sourceId`. */
      sameSource: boolean;
      /** Per-field diff; a field maps to `null` when the two sides agree. */
      sourceDelta: ProvenanceDelta;
      /** Pre-filter signal: do the two materialised fingerprints match? */
      behaviourFingerprintEqual: boolean;
      /** Authoritative verifier verdict (composes C.1). */
      verifierVerdict: VerifierVerdict["kind"];
      note: string;
    };

const PROVENANCE_FIELDS: Array<keyof SchemeProvenance> = [
  "sourceCatalogue",
  "sourceId",
  "sourceVersion",
  "importedAt",
  "importerVersion",
  "createdBy",
  "createdAt",
];

function stripKey(p: { schemeKey: string } & SchemeProvenance): SchemeProvenance {
  const { schemeKey: _omit, ...rest } = p;
  return rest;
}

/**
 * D.2 — compose two D.1 reads with the C.1 verifier. Answers "is this the same
 * scheme under two presentations?": `sameSource` + the per-field `sourceDelta`
 * locate provenance divergence, while `behaviourFingerprintEqual` /
 * `verifierVerdict` carry the behaviour-equality signal (the fingerprint is a
 * necessary-but-not-sufficient pre-filter; the verdict is authoritative).
 */
export async function compareSchemeProvenanceByKeys(
  keyA: string,
  keyB: string,
  options?: VerifierOptions,
  tx: Tx = defaultPrisma,
): Promise<CompareSchemeProvenanceResult> {
  const [provA, provB] = await Promise.all([
    getSchemeProvenanceByKey(keyA, tx),
    getSchemeProvenanceByKey(keyB, tx),
  ]);

  const missingKeys: string[] = [];
  if ("error" in provA) missingKeys.push(...provA.missingKeys);
  if ("error" in provB) missingKeys.push(...provB.missingKeys);
  if ("error" in provA || "error" in provB) {
    return { error: "scheme-not-found", missingKeys };
  }

  const provenanceA = stripKey(provA);
  const provenanceB = stripKey(provB);

  const sourceDelta = PROVENANCE_FIELDS.reduce((acc, field) => {
    const a = provenanceA[field];
    const b = provenanceB[field];
    (acc as Record<keyof SchemeProvenance, unknown>)[field] =
      a === b ? null : { a, b };
    return acc;
  }, {} as ProvenanceDelta);

  const sameSource =
    provenanceA.sourceCatalogue === provenanceB.sourceCatalogue &&
    (provenanceA.sourceId ?? null) === (provenanceB.sourceId ?? null);

  const equality = await verifySchemeEqualityByKey(keyA, keyB, options, tx);
  if ("error" in equality) {
    // Shouldn't happen (both rows resolved above), but stay faithful.
    return { error: "scheme-not-found", missingKeys: equality.missingKeys };
  }

  return {
    keyA,
    keyB,
    provenanceA,
    provenanceB,
    sameSource,
    sourceDelta,
    behaviourFingerprintEqual: equality.fingerprintsMatched,
    verifierVerdict: equality.verdict,
    note: "sameSource compares the catalogue of record (sourceCatalogue + sourceId). behaviourFingerprintEqual is a necessary-but-not-sufficient pre-filter; verifierVerdict is the authoritative behaviour-equality result ('inconclusive' ≠ 'incomparable').",
  };
}
