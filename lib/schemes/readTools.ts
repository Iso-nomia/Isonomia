/**
 * lib/schemes/readTools.ts
 *
 * Roadmap Phase C (SCHEMES_MCP_ALIGNMENT_ROADMAP §4) — the verifier "structural
 * radar" read surface. Three pure-ish read operations over the shipped verifier
 * + materialised fingerprint, shared by the HTTP routes that back the MCP tools:
 *
 *   C.1 verifySchemeEqualityByKey          → verify_scheme_equality
 *   C.2 computeSchemeFingerprintByKey       → compute_scheme_fingerprint
 *   C.3 findBehaviourallySimilarSchemesByKey → find_behaviourally_similar_schemes
 *
 * Discipline (P3 / Q-021): a fingerprint match is *necessary but not sufficient*
 * for behaviour equality — there is no canonical form, so the fingerprint is only
 * a pre-filter and the verifier supplies the authoritative verdict. Every result
 * shape here keeps that distinction explicit so a consumer never reads
 * `inconclusive` as `incomparable`.
 */

import { prisma as defaultPrisma } from "@/lib/prismaclient";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  verifyBehaviourEquality,
  computeBehaviourFingerprint,
  type SchemeWithCqs,
  type VerifierVerdict,
  type VerifierOptions,
} from "@/lib/schemes/verifier";

type Tx = PrismaClient | Prisma.TransactionClient;

export async function loadSchemeWithCqsByKey(
  key: string,
  tx: Tx = defaultPrisma,
): Promise<SchemeWithCqs | null> {
  const row = await tx.argumentScheme.findUnique({
    where: { key },
    include: { cqs: true },
  });
  return (row as SchemeWithCqs) ?? null;
}

/** The verdict's certificate (equal/subset/incomparable) or reason (inconclusive). */
function witnessOrCounterOf(verdict: VerifierVerdict): unknown {
  switch (verdict.kind) {
    case "equal":
    case "subset":
    case "incomparable":
      return (verdict as any).certificate;
    case "inconclusive":
      return { reason: verdict.reason };
    default:
      return null;
  }
}

/** Materialised fingerprint if present, else recomputed from the CQ-bundle. */
function fingerprintOf(scheme: SchemeWithCqs): { value: string; materialised: boolean } {
  const stored = (scheme as any).fingerprint as string | null | undefined;
  if (stored && stored.length > 0) return { value: stored, materialised: true };
  return {
    value: computeBehaviourFingerprint({
      premises: (scheme as any).premises,
      conclusion: (scheme as any).conclusion,
      epistemicMode: (scheme as any).epistemicMode,
      cqs: scheme.cqs as any,
    }),
    materialised: false,
  };
}

export type VerifySchemeEqualityResult =
  | { error: "scheme-not-found"; missingKeys: string[] }
  | {
      keyA: string;
      keyB: string;
      verdict: VerifierVerdict["kind"];
      witnessOrCounter: unknown;
      runtimeMs: number;
      fingerprintsMatched: boolean;
      /** Reminder framing for consumers (necessary-but-not-sufficient). */
      note: string;
    };

/**
 * C.1 — run the shipped verifier between two schemes addressed by key.
 */
export async function verifySchemeEqualityByKey(
  keyA: string,
  keyB: string,
  options?: VerifierOptions,
  tx: Tx = defaultPrisma,
): Promise<VerifySchemeEqualityResult> {
  const [a, b] = await Promise.all([
    loadSchemeWithCqsByKey(keyA, tx),
    loadSchemeWithCqsByKey(keyB, tx),
  ]);
  const missingKeys: string[] = [];
  if (!a) missingKeys.push(keyA);
  if (!b) missingKeys.push(keyB);
  if (!a || !b) return { error: "scheme-not-found", missingKeys };

  const start = Date.now();
  const verdict = await verifyBehaviourEquality(a, b, options);
  const runtimeMs = Date.now() - start;

  const fpA = fingerprintOf(a);
  const fpB = fingerprintOf(b);

  return {
    keyA,
    keyB,
    verdict: verdict.kind,
    witnessOrCounter: witnessOrCounterOf(verdict),
    runtimeMs,
    fingerprintsMatched: fpA.value === fpB.value,
    note: "A behaviour-equality verdict is authoritative; a fingerprint match is necessary but NOT sufficient for equality (no canonical form — P3/Q-021). 'inconclusive' means the verifier could not decide, not 'incomparable'.",
  };
}

export type ComputeFingerprintResult =
  | { error: "scheme-not-found"; missingKeys: string[] }
  | {
      schemeKey: string;
      behaviourFingerprint: string;
      materialised: boolean;
      note: string;
    };

/**
 * C.2 — read the materialised fingerprint for a scheme (recompute if the column
 * is null). Documented as a pre-filter only.
 */
export async function computeSchemeFingerprintByKey(
  key: string,
  tx: Tx = defaultPrisma,
): Promise<ComputeFingerprintResult> {
  const scheme = await loadSchemeWithCqsByKey(key, tx);
  if (!scheme) return { error: "scheme-not-found", missingKeys: [key] };
  const fp = fingerprintOf(scheme);
  return {
    schemeKey: key,
    behaviourFingerprint: fp.value,
    materialised: fp.materialised,
    note: "The fingerprint is a structural pre-filter, not a proof of equality. Two schemes sharing a fingerprint are equality CANDIDATES — confirm with verify_scheme_equality.",
  };
}

export type SimilarSchemeHit = {
  schemeKey: string;
  schemeName: string | null;
  verdict: VerifierVerdict["kind"];
  fingerprintMatched: boolean;
};

export type FindSimilarResult =
  | { error: "scheme-not-found"; missingKeys: string[] }
  | {
      schemeKey: string;
      behaviourFingerprint: string;
      candidatesConsidered: number;
      hits: SimilarSchemeHit[];
      note: string;
    };

/**
 * C.3 — the redundancy radar. Bucket the catalogue by the target's fingerprint
 * (indexed), then verifier-confirm each same-fingerprint candidate. Returns up
 * to `k` hits ordered equal → subset → incomparable → inconclusive. At the Phase
 * 4d baseline (0 equal / 0 subset, partial-unique fingerprint index) this returns
 * an empty `hits` for every current row; the mechanism guards import-time drift.
 */
export async function findBehaviourallySimilarSchemesByKey(
  key: string,
  k = 5,
  tx: Tx = defaultPrisma,
  searchBoundMs = 250,
): Promise<FindSimilarResult> {
  const target = await loadSchemeWithCqsByKey(key, tx);
  if (!target) return { error: "scheme-not-found", missingKeys: [key] };

  const fp = fingerprintOf(target);

  // Fingerprint bucket (indexed on the materialised column). Recomputed-only
  // rows won't be indexed, but the common case is a materialised target.
  const candidates = (await tx.argumentScheme.findMany({
    where: {
      fingerprint: fp.value,
      kind: "argument-scheme",
      id: { not: (target as any).id },
    } as any,
    include: { cqs: true },
  })) as unknown as SchemeWithCqs[];

  const rank: Record<VerifierVerdict["kind"], number> = {
    equal: 0,
    subset: 1,
    incomparable: 2,
    inconclusive: 3,
  };

  const hits: SimilarSchemeHit[] = [];
  for (const cand of candidates) {
    const verdict = await verifyBehaviourEquality(target, cand, { searchBoundMs });
    hits.push({
      schemeKey: (cand as any).key,
      schemeName: (cand as any).name ?? null,
      verdict: verdict.kind,
      fingerprintMatched: true,
    });
  }
  hits.sort((x, y) => rank[x.verdict] - rank[y.verdict]);

  return {
    schemeKey: key,
    behaviourFingerprint: fp.value,
    candidatesConsidered: candidates.length,
    hits: hits.slice(0, k),
    note: "Candidates are pre-filtered by fingerprint (necessary condition) and confirmed by the verifier (authoritative). An empty hits list means no behavioural near-duplicate, not 'not checked'.",
  };
}
