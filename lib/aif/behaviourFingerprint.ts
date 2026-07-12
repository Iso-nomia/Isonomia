/**
 * lib/aif/behaviourFingerprint.ts
 *
 * Phase 4c (folksonomy roadmap step 17) — AIF round-trip identity discipline.
 *
 * Two responsibilities:
 *
 *   1. Export side. Given a set of `ArgumentScheme` ids referenced by an
 *      AIF document, materialise a `Map<schemeId, BehaviourFingerprint>` so
 *      the exporter can stamp each RA / Scheme node with
 *      `mesh:behaviourFingerprint`. The function prefers the materialised
 *      `ArgumentScheme.fingerprint` column (Phase 2 step 9) and falls back
 *      to recomputing via `computeBehaviourFingerprint` for legacy rows
 *      whose column is null.
 *
 *   2. Import side. Given an incoming `mesh:behaviourFingerprint`, look up
 *      existing `ArgumentScheme` rows that match by fingerprint hash. The
 *      lookup uses the partial-unique index on `(fingerprint)` for
 *      `kind='argument-scheme'` rows and is therefore O(1) per call.
 *
 *      The fingerprint is only a candidate-set hint (see Spec 4 §3.5):
 *      callers MUST run the verifier before merging an incoming
 *      presentation as a `SchemeVariant`. This module exposes a thin
 *      `verifyAgainstResolved` helper that wraps `verifyBehaviourEquality`
 *      against the resolved candidate so import-path code stays small.
 *
 *      Conservative posture (spec §3.5 §5 phase 4c):
 *        - `equal`           → caller may attach as a variant.
 *        - `subset`          → caller mints new + logs (the new presentation
 *                              is strictly weaker; not a duplicate).
 *        - `incomparable`    → caller mints new + logs.
 *        - `inconclusive`    → caller mints new + logs the verdict.
 *      No silent merge under any code path.
 */

import { prisma as defaultPrisma } from "@/lib/prismaclient";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  computeBehaviourFingerprint,
  type BehaviourFingerprint,
} from "@/lib/schemes/verifier/computeFingerprint";
import {
  verifyBehaviourEquality,
  type VerifierVerdict,
} from "@/lib/schemes/verifier/behaviourEquality";
import type { SchemeWithCqs } from "@/lib/schemes/verifier/behaviourEquality";

type Tx = PrismaClient | Prisma.TransactionClient;

/**
 * Bulk-load fingerprints for the supplied scheme ids. Order of return matches
 * the input order; missing ids are absent from the resulting map (rather than
 * mapping to null) so callers can distinguish "not in catalogue" from
 * "fingerprint not yet materialised".
 *
 * Performance: one `findMany` over the `id IN (...)` set. For rows with a
 * materialised `fingerprint`, the column value is returned verbatim. For
 * legacy rows where the column is null, the fingerprint is recomputed from
 * the row's CQ-bundle on the spot — this matches the verifier's view, since
 * the materialised column is also the output of `computeBehaviourFingerprint`
 * over the same canonicalisation.
 */
export async function loadFingerprintsForSchemes(
  schemeIds: ReadonlyArray<string>,
  tx: Tx = defaultPrisma,
): Promise<Map<string, BehaviourFingerprint>> {
  const out = new Map<string, BehaviourFingerprint>();
  if (schemeIds.length === 0) return out;
  const unique = Array.from(new Set(schemeIds));

  const rows = await tx.argumentScheme.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      fingerprint: true,
      epistemicMode: true,
      premises: true,
      conclusion: true,
      cqs: {
        select: { cqKey: true, attackType: true, targetScope: true },
      },
    },
  });

  for (const row of rows) {
    if (row.fingerprint && row.fingerprint.length > 0) {
      out.set(row.id, row.fingerprint);
      continue;
    }
    // Legacy fallback — keep the wire format consistent with the materialised
    // column for rows that haven't been touched by an admin write since the
    // Phase 2 step 9 backfill.
    const fp = computeBehaviourFingerprint({
      premises: row.premises,
      conclusion: row.conclusion,
      epistemicMode: row.epistemicMode ?? null,
      cqs: row.cqs.map((c) => ({
        cqKey: c.cqKey,
        attackType: c.attackType,
        targetScope: c.targetScope,
      })),
    });
    out.set(row.id, fp);
  }
  return out;
}

export type FingerprintResolution =
  | {
      kind: "match";
      schemeId: string;
      schemeKey: string;
      schemeName: string | null;
      fingerprint: BehaviourFingerprint;
    }
  | {
      kind: "no_match";
      fingerprint: BehaviourFingerprint;
    };

/**
 * Look up an existing `ArgumentScheme` row by behaviour-fingerprint hash.
 *
 * Returns at most one match (the partial-unique index on
 * `(fingerprint) WHERE kind='argument-scheme'` makes this safe). Callers
 * should treat a `no_match` result as "mint new" and a `match` result as
 * "candidate worth verifying".
 */
export async function resolveSchemeByFingerprint(
  fingerprint: BehaviourFingerprint,
  tx: Tx = defaultPrisma,
): Promise<FingerprintResolution> {
  if (typeof fingerprint !== "string" || fingerprint.length === 0) {
    return { kind: "no_match", fingerprint: "" };
  }
  const row = await tx.argumentScheme.findFirst({
    where: { fingerprint, kind: "argument-scheme" },
    select: { id: true, key: true, name: true },
  });
  if (!row) return { kind: "no_match", fingerprint };
  return {
    kind: "match",
    schemeId: row.id,
    schemeKey: row.key,
    schemeName: row.name,
    fingerprint,
  };
}

export type ImportResolutionDecision =
  | {
      action: "attach_existing";
      schemeId: string;
      schemeKey: string;
      verdict: VerifierVerdict;
      fingerprint: BehaviourFingerprint;
    }
  | {
      action: "mint_new";
      reason: "no_fingerprint" | "no_match" | "subset" | "incomparable" | "inconclusive";
      verdict: VerifierVerdict | null;
      fingerprint: BehaviourFingerprint;
      candidateSchemeId: string | null;
    };

/**
 * Import-path entry point. Takes the incoming presentation (already
 * normalised to a `SchemeWithCqs`-shaped draft by the caller) and the
 * fingerprint stamped on the wire, and returns a structured decision the
 * importer can act on without further policy.
 *
 * The verifier is invoked ONLY when a fingerprint match exists — saving the
 * verifier budget on the (overwhelmingly common) case where no candidate
 * shares the fingerprint. The returned `verdict` is preserved on every
 * `mint_new` outcome so the import path can persist it in its log.
 */
export async function decideImportResolution(args: {
  fingerprint: BehaviourFingerprint | null | undefined;
  incomingDraft: SchemeWithCqs;
  tx?: Tx;
  searchBoundMs?: number;
}): Promise<ImportResolutionDecision> {
  const tx: Tx = args.tx ?? defaultPrisma;
  const fp = args.fingerprint ?? "";
  if (!fp) {
    return {
      action: "mint_new",
      reason: "no_fingerprint",
      verdict: null,
      fingerprint: "",
      candidateSchemeId: null,
    };
  }

  const resolution = await resolveSchemeByFingerprint(fp, tx);
  if (resolution.kind !== "match") {
    return {
      action: "mint_new",
      reason: "no_match",
      verdict: null,
      fingerprint: fp,
      candidateSchemeId: null,
    };
  }

  // Pull the catalogue row in full so the verifier can compare CQ bundles.
  const candidate = await tx.argumentScheme.findUnique({
    where: { id: resolution.schemeId },
    include: { cqs: true },
  });
  if (!candidate) {
    // Race: row vanished between findFirst and findUnique. Treat as no-match.
    return {
      action: "mint_new",
      reason: "no_match",
      verdict: null,
      fingerprint: fp,
      candidateSchemeId: null,
    };
  }

  const verdict = await verifyBehaviourEquality(args.incomingDraft, candidate as unknown as SchemeWithCqs, {
    searchBoundMs: args.searchBoundMs ?? 250,
  });

  if (verdict.kind === "equal") {
    return {
      action: "attach_existing",
      schemeId: resolution.schemeId,
      schemeKey: resolution.schemeKey,
      verdict,
      fingerprint: fp,
    };
  }

  return {
    action: "mint_new",
    reason: verdict.kind, // "subset" | "incomparable" | "inconclusive"
    verdict,
    fingerprint: fp,
    candidateSchemeId: resolution.schemeId,
  };
}
