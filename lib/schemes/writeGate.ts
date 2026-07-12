/**
 * lib/schemes/writeGate.ts
 *
 * Roadmap B.1 (SCHEMES_MCP_ALIGNMENT_ROADMAP §4 Phase B) — the honesty-critical
 * health-selection gate for argument WRITE tools.
 *
 * MCP write tools never re-run scheme-definition workflows (WF1/WF2/WF3 live on
 * the admin definition path — §1.4 seam). What they MUST do is *select* a
 * healthy scheme: refuse dialogue-meta / test-placeholder rows, and redirect a
 * folksonomy duplicate to its canonical sibling rather than silently minting an
 * instance against the wrong row. This module centralises that policy so both
 * the HTTP route and any future write surface share one implementation.
 *
 * Posture (mirrors decideImportResolution / §1.4): never a silent merge — a
 * canonical redirect is always surfaced to the caller as an auditable warning.
 */

import { prisma as defaultPrisma } from "@/lib/prismaclient";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  buildFingerprintPeerIndex,
  computeCatalogueHealth,
  type CatalogueHealth,
} from "@/lib/schemes/catalogueHealth";
import {
  verifyBehaviourEquality,
  type SchemeWithCqs,
} from "@/lib/schemes/verifier";
import type { SchemeWriteErrorCode } from "@/lib/schemes/schemeWriteCodes";

type Tx = PrismaClient | Prisma.TransactionClient;

export type ResolvedWriteScheme = {
  id: string;
  key: string;
  name: string;
  /** The scheme's catalogue epistemic mode (FACTUAL | HYPOTHETICAL | COUNTERFACTUAL). */
  epistemicMode: string;
  fingerprint: string | null;
  health: CatalogueHealth;
};

export type WriteGateResult =
  | {
      ok: true;
      scheme: ResolvedWriteScheme;
      /** Original requested key when the gate auto-redirected to a canonical sibling. */
      canonicalizedFrom: string | null;
    }
  | {
      ok: false;
      code: SchemeWriteErrorCode;
      /** The corrected/applied value, or `null` when there is no automatic fix. */
      canonical: string | null;
      requestedKey: string;
      reason: string;
    };

const SCHEME_SELECT = {
  id: true,
  key: true,
  name: true,
  kind: true,
  clusterTag: true,
  fingerprint: true,
  epistemicMode: true,
} as const;

/**
 * Resolve a caller-supplied `schemeKey` to a *healthy, canonical* argument
 * pattern, or refuse with a typed code. Used by argument write tools (B.1).
 *
 *   - Unknown key                       → `SCHEME_UNKNOWN`.
 *   - dialogue-meta / test-placeholder  → `SCHEME_NOT_ARGUMENT_PATTERN`.
 *   - folksonomy duplicate              → auto-redirect to `canonicalKey`,
 *                                          `canonicalizedFrom` records the original.
 */
export async function resolveSchemeForWrite(
  schemeKey: string,
  tx: Tx = defaultPrisma,
): Promise<WriteGateResult> {
  // Peer index over the argument-pattern catalogue feeds duplicate detection.
  const catalogue = await tx.argumentScheme.findMany({
    where: { kind: "argument-scheme" } as any,
    select: { key: true, fingerprint: true } as any,
  });
  const peerIndex = buildFingerprintPeerIndex(catalogue as any);

  const resolveOne = (key: string) =>
    tx.argumentScheme.findUnique({
      where: { key },
      select: SCHEME_SELECT as any,
    }) as Promise<any | null>;

  let row = await resolveOne(schemeKey);
  if (!row) {
    return {
      ok: false,
      code: "SCHEME_UNKNOWN",
      canonical: null,
      requestedKey: schemeKey,
      reason: `Unknown schemeKey '${schemeKey}'.`,
    };
  }

  const healthOf = (r: any): CatalogueHealth =>
    computeCatalogueHealth(
      {
        key: r.key,
        kind: r.kind,
        clusterTag: r.clusterTag,
        fingerprint: r.fingerprint,
      },
      peerIndex,
    );

  let health = healthOf(row);

  // Gate: refuse non-argument-pattern rows outright (the honesty payload).
  if (health.isDialogueMeta || health.isTestPlaceholder) {
    return {
      ok: false,
      code: "SCHEME_NOT_ARGUMENT_PATTERN",
      canonical: null,
      requestedKey: schemeKey,
      reason: health.isDialogueMeta
        ? `Scheme '${schemeKey}' is dialogue-meta machinery, not an argument pattern, and cannot anchor an argument. Call list_schemes(excludeUnhealthy: true) to pick a real pattern.`
        : `Scheme '${schemeKey}' is a test/placeholder entry, not a production argument pattern. Call list_schemes(excludeUnhealthy: true) to pick a real pattern.`,
    };
  }

  // Canonicalize a folksonomy duplicate (never a silent merge — §1.4).
  let canonicalizedFrom: string | null = null;
  if (health.duplicateOf && health.duplicateOf !== row.key) {
    const canonical = await resolveOne(health.duplicateOf);
    if (canonical) {
      canonicalizedFrom = row.key;
      row = canonical;
      health = healthOf(row);
    }
  }

  return {
    ok: true,
    canonicalizedFrom,
    scheme: {
      id: row.id,
      key: row.key,
      name: row.name,
      epistemicMode: row.epistemicMode ?? "FACTUAL",
      fingerprint: row.fingerprint ?? null,
      health,
    },
  };
}

export type WriteVerifierVerdict = {
  /** `skipped` when no same-fingerprint peer exists (the Phase 4d baseline case). */
  kind: "equal" | "subset" | "incomparable" | "inconclusive" | "skipped";
  /** The peer scheme key the verdict is against, or null when skipped. */
  againstSchemeKey: string | null;
  runtimeMs: number;
};

/**
 * Run the shipped behaviour-equality verifier between the resolved scheme and
 * any catalogue sibling sharing its fingerprint. Necessary-but-not-sufficient:
 * a same-fingerprint peer is only a *candidate* for equality (Spec 4 §3.5);
 * the verifier supplies the authoritative verdict. At the Phase 4d baseline the
 * partial-unique fingerprint index means there are no same-fingerprint peers,
 * so this returns `skipped` — but the mechanism guards legacy / future drift.
 */
export async function verifyAgainstFingerprintPeers(
  schemeId: string,
  fingerprint: string | null,
  tx: Tx = defaultPrisma,
  searchBoundMs = 250,
): Promise<WriteVerifierVerdict> {
  if (!fingerprint) return { kind: "skipped", againstSchemeKey: null, runtimeMs: 0 };

  const peers = await tx.argumentScheme.findMany({
    where: { fingerprint, kind: "argument-scheme", id: { not: schemeId } } as any,
    include: { cqs: true },
  });
  if (peers.length === 0) {
    return { kind: "skipped", againstSchemeKey: null, runtimeMs: 0 };
  }

  const self = await tx.argumentScheme.findUnique({
    where: { id: schemeId },
    include: { cqs: true },
  });
  if (!self) return { kind: "skipped", againstSchemeKey: null, runtimeMs: 0 };

  const start = Date.now();
  const verdict = await verifyBehaviourEquality(
    self as unknown as SchemeWithCqs,
    peers[0] as unknown as SchemeWithCqs,
    { searchBoundMs },
  );
  return {
    kind: verdict.kind,
    againstSchemeKey: (peers[0] as any).key,
    runtimeMs: Date.now() - start,
  };
}
