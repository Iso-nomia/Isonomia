/**
 * Argument Attestation Envelope
 *
 * Track A.2 of the AI-Epistemic-Infrastructure Roadmap.
 *
 * Builds a canonical, content-addressed "attestation envelope" for an
 * argument permalink. The envelope is the unit an LLM (or any external
 * citer) should embed when referencing an Isonomia argument. It includes:
 *   - The stable permalink + version
 *   - A sha256 content hash over the canonical AIF-relevant fields
 *   - The dialectical status (attacks / supports / CQ counters / standing)
 *   - Evidence provenance pointers
 *
 * Re-used by:
 *   - The rich JSON-LD on the public argument page (/a/[identifier])
 *   - The AIF-JSON-LD content-negotiated endpoint
 *   - The MCP server (Track B.2)
 *   - The future public REST API (Track B.3)
 */

import crypto from "crypto";
import { prisma } from "@/lib/prismaclient";
import {
  classifyStandingConfidence,
  type StandingConfidence,
} from "@/config/standingThresholds";
import { toCitationBlock, type CitationBlock } from "@/lib/citation/serialize";
import { toIsoId, toIsoUrl } from "@/lib/citations/isoIdentifier";
import { loadPlatformWitnessKey } from "@/lib/keys/keyService";
import {
  signSummaryEnvelope,
  type SignedAttestationEnvelope,
} from "@/lib/citations/signedAttestation";
import {
  buildFingerprintPeerIndex,
  computeCatalogueHealth,
  type CatalogueHealth,
} from "@/lib/schemes/catalogueHealth";
import {
  projectSchemeInstanceState,
  type SchemeInstanceStateProjection,
} from "@/lib/schemes/protocol/instanceState";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

// Fitness scoring weights — kept here so the search route, the attestation
// envelope, and the verifier all read from a single source of truth
// (Track AI-EPI Pt. 3 §1).
export const FITNESS_WEIGHTS = {
  cqAnswered: 1.0,
  supportEdges: 0.5,
  attackEdges: -0.7,
  attackCAs: -1.0,
  evidenceWithProvenance: 0.25,
} as const;

// ============================================================
// TYPES
// ============================================================

export type Testedness = "untested" | "lightly_tested" | "well_tested";

/**
 * Whether an argument was authored by a human, an LLM-driven seeding flow,
 * or a hybrid (human-edited AI draft). Surfaced in the attestation envelope
 * so downstream consumers — and any LLM citing the argument — can flag
 * AI-authored content explicitly.
 *
 * Mirrors the `AuthorKind` enum in the Prisma schema.
 */
export type AuthorKind = "HUMAN" | "AI" | "HYBRID";

/**
 * Itemised view of a single critical question for an argument.
 * `status` mirrors the `CQStatus.statusEnum` values for the underlying
 * row, with `"missing"` reserved for catalog CQs that have no status row
 * yet (i.e. the CQ has never been engaged).
 */
export interface CriticalQuestionStatus {
  cqKey: string;
  text: string;
  attackKind: string | null;
  /**
   * Stable handle to the underlying `CQStatus` row for this CQ on this
   * argument (Roadmap S2). `null` when no status row exists yet — the CQ is
   * open but never touched, and the answer route will create the row on first
   * answer. Pass this (or `cqKey` + `schemeKey`) to `answer_critical_question`.
   */
  cqStatusId: string | null;
  /**
   * Scheme the CQ is anchored on (Roadmap S2). Mirrors
   * `CriticalQuestionsAggregate.schemeKey` for the primary scheme; surfaced
   * per-item so the answer caller can disambiguate inherited CQs.
   */
  schemeKey: string | null;
  /**
   * Carneades premise classification of the CQ's target premise
   * (`ORDINARY` | `ASSUMPTION` | `EXCEPTION`), read straight from the shipped
   * `CriticalQuestion.premiseType` column (Spec 3 / Roadmap A.2). `null` when
   * the catalogue row leaves it unset.
   */
  premiseType: "ORDINARY" | "ASSUMPTION" | "EXCEPTION" | null;
  /**
   * Derived (no column): a CQ must be actively adjudicated for the instance to
   * close iff its premise is not a Carneades `ASSUMPTION` (assumptions
   * auto-waive at gate-check time). Mirrors the E2 obligation projection.
   */
  isSchemeRequired: boolean;
  /**
   * Derived (no column): true iff the CQ definition is anchored on a different
   * scheme than the argument's primary scheme (pulled in from a parent).
   */
  inheritedFromParentScheme: boolean;
  /**
   * Raw `CQStatus.statusEnum` for this CQ (null when no status row exists).
   * `DISPUTED` is the challenge state (Challenging-Answered-CQ §11.6): the CQ
   * had a canonical answer that a structural contester has re-opened.
   */
  cqStatusEnum:
    | "OPEN"
    | "PENDING_REVIEW"
    | "PARTIALLY_SATISFIED"
    | "SATISFIED"
    | "DISPUTED"
    | null;
  /** True iff at least one challenge (`CQAttack`) is on file for this CQ. */
  challenged: boolean;
  /** Number of challenges (`CQAttack` rows) filed against this CQ (§11.6). */
  challengeCount: number;
  /**
   * Catalogue `CriticalQuestion.requiresEvidence` for this CQ (master switch
   * for the challenge-evidence bar, §11.2.1). Lets a client mirror the server
   * admissibility check before a round-trip. False when unset.
   */
  cqRequiresEvidence: boolean;
  /**
   * Catalogue `CriticalQuestion.burdenOfProof` for this CQ. With
   * `cqRequiresEvidence`, drives who must cite evidence to challenge / exit
   * DISPUTED (§12.3). Defaults `PROPONENT`.
   */
  cqBurden: "PROPONENT" | "CHALLENGER" | "OPPONENT";
  /**
   * Whether the argument carrying this CQ's canonical answer was self-asserted
   * by an AI agent over MCP (§12.1) — derived from the argument's `authorKind` +
   * `aiProvenance` with the same predicate as `isSelfCanonicalEligible`, minus
   * the session-match clause. Feeds the "answered by an AI agent" challenge
   * nudge; never gates anything.
   */
  answerSelfCanonical: boolean;
  /** The argument's `AuthorKind` (the answer's authorship proxy, §12.1). */
  answerAuthorKind: "HUMAN" | "AI" | "HYBRID";
  status:
    | "missing"
    | "open"
    | "pending_review"
    | "partially_satisfied"
    | "satisfied"
    | "disputed";
}

/**
 * Aggregated CQ status for an argument — saves clients from inferring
 * "which CQs are unanswered?" from absence (Track AI-EPI Pt. 3 §2).
 */
export interface CriticalQuestionsAggregate {
  schemeKey: string | null;
  total: number;
  answered: CriticalQuestionStatus[];
  partiallyAnswered: CriticalQuestionStatus[];
  unanswered: CriticalQuestionStatus[];
}

/**
 * Decomposition of the dialectical-fitness score into its weighted
 * contributors. Lets clients display the score as auditable structure
 * rather than an opaque scalar (Track AI-EPI Pt. 3 §1).
 */
export interface FitnessBreakdown {
  total: number;
  components: {
    cqAnswered:             { count: number; weight: number; contribution: number };
    supportEdges:           { count: number; weight: number; contribution: number };
    attackEdges:            { count: number; weight: number; contribution: number };
    attackCAs:              { count: number; weight: number; contribution: number };
    evidenceWithProvenance: { count: number; weight: number; contribution: number };
  };
  weights: typeof FITNESS_WEIGHTS;
}

/**
 * Participation-depth annotation on a `StandingState` label
 * (Track AI-EPI Pt. 3 §3). Tells a consumer that
 * "tested-survived" with one challenger and zero independent reviewers is
 * not the same epistemic object as "tested-survived" with twenty
 * challengers and ten reviewers.
 */
export interface StandingDepth {
  /** Distinct authors who have attacked this argument (via edges or CAs). */
  challengers: number;
  /** Distinct authors who have provided support (via support edges). */
  independentReviewers: number;
  lastChallengedAt: string | null;
  lastDefendedAt: string | null;
  confidence: StandingConfidence;
}

/**
 * 5-bucket classifier over standingScore + inbound traffic + CQ work.
 * Documented in the OpenAPI spec; surfaced on every attestation envelope and
 * every search result so LLMs don't have to re-derive it from raw counters.
 *
 * Buckets:
 *   - "untested-default"    — no scheme apparatus + no inbound traffic
 *   - "untested-supported"  — has supports / answered CQs but no attacks
 *   - "tested-attacked"     — has attacks, no supports / answered CQs
 *   - "tested-undermined"   — attacks > supports and not yet survived
 *   - "tested-survived"     — isTested === true and supports >= attacks
 */
export type StandingState =
  | "untested-default"
  | "untested-supported"
  | "tested-attacked"
  | "tested-undermined"
  | "tested-survived";

export function computeStandingState(input: {
  isTested: boolean;
  criticalQuestionsAnswered: number;
  incomingAttacks: number;
  incomingAttackEdges: number;
  incomingSupports: number;
}): StandingState {
  const attacks = input.incomingAttacks + input.incomingAttackEdges;
  const supports = input.incomingSupports;
  const cqAnswered = input.criticalQuestionsAnswered;

  if (input.isTested && supports >= attacks) return "tested-survived";
  if (attacks > 0 && attacks > supports + cqAnswered) return "tested-undermined";
  if (attacks > 0) return "tested-attacked";
  if (supports > 0 || cqAnswered > 0) return "untested-supported";
  return "untested-default";
}

export interface DialecticalStatus {
  /** Inbound conflict applications targeting this argument or its conclusion */
  incomingAttacks: number;
  /** Inbound argument-edges of type SUPPORT */
  incomingSupports: number;
  /** Inbound argument-edges of type ATTACK (rebut/undercut/undermine) */
  incomingAttackEdges: number;
  /** Critical questions defined for the primary scheme */
  criticalQuestionsRequired: number;
  /** Critical questions answered/satisfied for this argument */
  criticalQuestionsAnswered: number;
  /** Critical questions currently OPEN */
  criticalQuestionsOpen: number;
  /**
   * Heuristic standing score in [0, 1]. Combines CQ satisfaction and
   * attack-resistance. Intended as a quick orientation signal only — not
   * a formal Dung-style acceptability label.
   *
   * `null` when there is no scheme attached (no CQ structure to score
   * against) and no inbound traffic. Reading a non-null score implies the
   * argument has at least one CQ slot defined or has received dialectical
   * pressure. This avoids the "0 CQs required → standing 1.0" artifact
   * that misled clients in early MCP transcripts.
   */
  standingScore: number | null;
  /** True if the argument has crossed the "dialectically tested" threshold */
  isTested: boolean;
  /**
   * Coarse human/LLM-readable testedness label derived from CQ counts and
   * inbound traffic. Saves clients from reverse-engineering it from raw
   * counters.
   *   - "untested"        — no CQs answered, no incoming attacks/supports
   *   - "lightly_tested"  — 1 CQ answered OR 1 attack OR 1 support
   *   - "well_tested"     — isTested === true
   */
  testedness: Testedness;
  /**
   * 5-bucket classifier (see StandingState). Prefer this over the raw
   * standingScore / isTested fields — it's the citation-ready summary
   * label LLMs should surface to end-users.
   */
  standingState: StandingState;

  /**
   * Participation-depth annotation on `standingState`. A `tested-survived`
   * label with `depth.confidence === "thin"` should be read as
   * "survived the one challenge it has faced", not as "vetted by the
   * field". (Track AI-EPI Pt. 3 §3.)
   */
  standingDepth: StandingDepth;

  /**
   * Decomposition of the dialectical-fitness score into its weighted
   * components. Lets clients display the score as auditable structure
   * rather than an opaque scalar. (Track AI-EPI Pt. 3 §1.)
   */
  fitnessBreakdown: FitnessBreakdown;
}

export interface EvidenceProvenance {
  evidenceId: string;
  uri: string | null;
  title: string | null;
  citation: string | null;
  /** sha256 of the source body, when archived (Track A.4) */
  contentSha256: string | null;
  /** Wayback / archive.org snapshot URL, when archived (Track A.4) */
  archivedUrl: string | null;
  archivedAt: string | null;
}

export interface ArgumentAttestation {
  /** The canonical short-code permalink path component (or argument id fallback) */
  identifier: string;
  /** Argument record id */
  argumentId: string;
  /** Stable permalink URL */
  permalink: string;
  /** Permalink version (bumps on substantive edits) */
  version: number;
  /** sha256 over the canonical attested payload (see canonicalPayload below) */
  contentHash: string;
  /** Immutable URL pinned to the current contentHash (server-stable address) */
  immutablePermalink: string;
  /**
   * Stable URN identifier (Track AI-EPI E.2). Format `iso:argument:<shortCode>`.
   * Deterministic from the shortCode, so it never changes for an argument.
   * Resolves via `iso/argument/<shortCode>` → 301 → `/a/<shortCode>`.
   */
  isoId: string;
  /** Resolver URL form of `isoId` — the canonical HTTP address for the iso: id. */
  isoUrl: string;
  /**
   * Real DOI when one has been minted via Crossref / DataCite (Track
   * AI-EPI E.2 stretch). `null` until the registrar is configured and
   * this argument has been registered. See [lib/citations/doiMinter.ts](./doiMinter.ts).
   */
  doi: string | null;
  /** ISO timestamp when this attestation was generated */
  retrievedAt: string;
  /** ISO timestamp the underlying argument was created */
  createdAt: string | null;
  /** ISO timestamp the underlying argument was last updated */
  updatedAt: string | null;

  /** Conclusion claim (if any) */
  conclusion: {
    claimId: string;
    moid: string | null;
    text: string;
  } | null;

  /** Premises (claim id + text), in declared order */
  premises: Array<{
    claimId: string;
    moid: string | null;
    text: string;
    isImplicit: boolean;
  }>;

  /** Primary argumentation scheme (if assigned) */
  scheme: {
    id: string;
    key: string | null;
    name: string | null;
    title: string | null;
    /**
     * Canonical key when this scheme is a folksonomy duplicate-candidate
     * (collides on `fingerprint` with a lexicographically-smaller sibling);
     * equals `key` otherwise. From the E1 catalogue-health projection.
     */
    canonicalKey: string | null;
    /** Materialised behaviour-equality fingerprint, or null (Spec 4). */
    behaviourFingerprint: string | null;
    /** Derived catalogue-health projection (Roadmap E1). */
    catalogueHealth: CatalogueHealth | null;
  } | null;

  /** Evidence with provenance pointers (legacy shape) */
  evidence: EvidenceProvenance[];

  /**
   * Citations as canonical `CitationBlock`s — the shape downstream UIs and
   * MCP consumers should prefer. Mirrors `evidence` 1:1; we keep both
   * fields so existing clients don't break (Track AI-EPI Pt. 3 §7).
   */
  structuredCitations: CitationBlock[];

  /**
   * Per-CQ status aggregate. `null` when the argument has no primary
   * scheme attached (no CQ catalog to score against).
   * (Track AI-EPI Pt. 3 §2.)
   */
  criticalQuestions: CriticalQuestionsAggregate | null;

  /**
   * Play-time protocol state of the `SchemeInstance` attached to this
   * argument's conclusion (Roadmap A.2 / E2). Mirrors the projection served
   * by `GET /api/scheme-instances/[id]/state`: open vs discharged obligations
   * and close-hook eligibility. `null` when no instance has been materialised
   * for the conclusion + primary scheme pair (e.g. the argument predates the
   * obligation apparatus, or carries no scheme).
   */
  schemeInstance: SchemeInstanceStateProjection | null;

  /** Confidence in [0, 1] (author-supplied) */
  confidence: number | null;

  /** Dialectical status counters and standing score */
  dialecticalStatus: DialecticalStatus;

  /** Deliberation context */
  deliberation: {
    id: string;
    title: string | null;
  } | null;

  /** Author info (display only — not a signature; Track D.1 is future work) */
  author: {
    id: string | null;
    displayName: string | null;
    /**
     * Whether the argument was authored by a human, an AI drafting flow,
     * or a human-edited AI draft. (Track AI-EPI Pt. 3 §5.)
     */
    kind: AuthorKind;
    /**
     * When `kind !== "HUMAN"`, opaque provenance metadata about the AI
     * drafting run (model, prompt hash, source URLs, generated-at). Always
     * `null` for `kind === "HUMAN"`.
     */
    aiProvenance: Record<string, unknown> | null;
  } | null;

  /**
   * The exact serialized payload over which contentHash was computed. Useful
   * for debugging or for clients that want to re-verify the hash locally.
   * Always a string of canonical (sorted-keys) JSON.
   */
  canonicalPayload: string;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Stringify an object with deterministically sorted keys at every depth.
 * Required for stable content hashing across runs / hosts.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalStringify).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonicalStringify((value as Record<string, unknown>)[k])
      )
      .join(",") +
    "}"
  );
}

function sha256(s: string): string {
  return "sha256:" + crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Threshold rule for "dialectically tested": at least 2 critical questions
 * answered, OR at least one inbound attack with at least one inbound support.
 *
 * Activates the ClaimReview JSON-LD emission. Conservative on purpose —
 * the goal is to mark only arguments that have been pressure-tested.
 */
function computeIsTested(input: {
  criticalQuestionsAnswered: number;
  incomingAttacks: number;
  incomingSupports: number;
}): boolean {
  if (input.criticalQuestionsAnswered >= 2) return true;
  if (input.incomingAttacks >= 1 && input.incomingSupports >= 1) return true;
  return false;
}

/**
 * Heuristic standing score in [0, 1]. Not a Dung label — a quick orientation
 * signal for retrieval / ranking. Components:
 *   - CQ satisfaction ratio (weight 0.5)
 *   - Attack resistance: 1 / (1 + incomingAttackPressure) (weight 0.5)
 *
 * Returns `null` when the argument has neither a scheme defining CQs nor
 * any inbound dialectical traffic. This prevents a free-pass 1.0 for
 * arguments that simply have no apparatus attached — a real
 * misrepresentation surfaced by the first round of MCP transcripts.
 */
function computeStandingScore(input: {
  criticalQuestionsRequired: number;
  criticalQuestionsAnswered: number;
  incomingAttacks: number;
  incomingAttackEdges: number;
  incomingSupports: number;
}): number | null {
  const {
    criticalQuestionsRequired,
    criticalQuestionsAnswered,
    incomingAttacks,
    incomingAttackEdges,
    incomingSupports,
  } = input;

  const totalInbound =
    incomingAttacks + incomingAttackEdges + incomingSupports;

  // No scheme attached AND no dialectical traffic → we have no signal.
  if (criticalQuestionsRequired === 0 && totalInbound === 0) return null;

  const attackPressure = Math.max(
    0,
    incomingAttacks + incomingAttackEdges - incomingSupports
  );
  const attackResistance = 1 / (1 + attackPressure);

  // No CQ apparatus → score on attack-resistance alone. Do NOT mix in a
  // synthetic 0.5 cqRatio (the previous behavior), which gave 0-CQ schemes
  // a structural standing-score advantage over schemes with a real CQ
  // catalog. The Round-2 Claude transcript flagged this as a real
  // ranking bug: an `expert_opinion` arg with 1/4 CQs answered scored
  // 0.375 while a `cause_to_effect` arg with no CQs at all scored 0.5.
  if (criticalQuestionsRequired === 0) {
    return Math.round(attackResistance * 1000) / 1000;
  }

  const cqRatio = Math.min(
    1,
    criticalQuestionsAnswered / criticalQuestionsRequired,
  );

  return Math.round((0.5 * cqRatio + 0.5 * attackResistance) * 1000) / 1000;
}

/**
 * Compose the dialectical-fitness scalar (and its breakdown) from raw
 * counters. Single source of truth for the formula \u2014 the search route, the
 * attestation envelope, and the verifier all call this. (Track AI-EPI Pt. 3
 * \u00a71.)
 */
export function computeFitnessBreakdown(input: {
  cqAnswered: number;
  supportEdges: number;
  attackEdges: number;
  attackCAs: number;
  evidenceWithProvenance: number;
}): FitnessBreakdown {
  const w = FITNESS_WEIGHTS;
  const components = {
    cqAnswered: {
      count: input.cqAnswered,
      weight: w.cqAnswered,
      contribution: input.cqAnswered * w.cqAnswered,
    },
    supportEdges: {
      count: input.supportEdges,
      weight: w.supportEdges,
      contribution: input.supportEdges * w.supportEdges,
    },
    attackEdges: {
      count: input.attackEdges,
      weight: w.attackEdges,
      contribution: input.attackEdges * w.attackEdges,
    },
    attackCAs: {
      count: input.attackCAs,
      weight: w.attackCAs,
      contribution: input.attackCAs * w.attackCAs,
    },
    evidenceWithProvenance: {
      count: input.evidenceWithProvenance,
      weight: w.evidenceWithProvenance,
      contribution: input.evidenceWithProvenance * w.evidenceWithProvenance,
    },
  };
  const totalRaw =
    components.cqAnswered.contribution +
    components.supportEdges.contribution +
    components.attackEdges.contribution +
    components.attackCAs.contribution +
    components.evidenceWithProvenance.contribution;
  return {
    total: Math.round(totalRaw * 1000) / 1000,
    components,
    weights: w,
  };
}

/**
 * Coarse testedness label \u2014 see `DialecticalStatus.testedness` for semantics.
 */
function computeTestedness(input: {
  criticalQuestionsAnswered: number;
  incomingAttacks: number;
  incomingSupports: number;
  incomingAttackEdges: number;
  isTested: boolean;
}): Testedness {
  if (input.isTested) return "well_tested";
  const anyTraffic =
    input.criticalQuestionsAnswered > 0 ||
    input.incomingAttacks > 0 ||
    input.incomingSupports > 0 ||
    input.incomingAttackEdges > 0;
  return anyTraffic ? "lightly_tested" : "untested";
}

// ============================================================
// MAIN BUILDER
// ============================================================

/**
 * Build an attestation envelope for an argument by id, using a chosen
 * `identifier` (shortCode preferred) for permalink construction.
 */
export async function buildArgumentAttestation(
  argumentId: string,
  identifier: string
): Promise<ArgumentAttestation | null> {
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      id: true,
      text: true,
      confidence: true,
      createdAt: true,
      lastUpdatedAt: true,
      authorId: true,
      authorKind: true,
      aiProvenance: true,
      conclusionClaimId: true,
      conclusion: {
        select: {
          id: true,
          text: true,
          moid: true,
          ClaimEvidence: {
            select: {
              id: true,
              title: true,
              uri: true,
              citation: true,
              contentSha256: true,
              byteSize: true,
              contentType: true,
              httpStatus: true,
              lastModifiedAt: true,
              fetchedAt: true,
              archivedUrl: true,
              archivedAt: true,
            } as any,
            take: 25,
          },
        },
      },
      premises: {
        select: {
          isImplicit: true,
          claim: { select: { id: true, text: true, moid: true } },
        },
        orderBy: { claimId: "asc" },
        take: 50,
      },
      argumentSchemes: {
        select: {
          isPrimary: true,
          order: true,
          scheme: {
            select: {
              id: true,
              key: true,
              name: true,
              title: true,
              kind: true,
              clusterTag: true,
              fingerprint: true,
              cqs: {
                select: {
                  id: true,
                  cqKey: true,
                  text: true,
                  attackKind: true,
                  premiseType: true,
                  schemeId: true,
                  burdenOfProof: true,
                  requiresEvidence: true,
                },
              },
            } as any,
          },
        },
        orderBy: [{ isPrimary: "desc" }, { order: "asc" }],
      },
      deliberation: { select: { id: true, title: true } },
      permalink: { select: { shortCode: true, version: true } },
    },
  });

  if (!argument) return null;

  const primarySchemeRow =
    argument.argumentSchemes.find((s) => s.isPrimary) ||
    argument.argumentSchemes[0] ||
    null;

  // ---- Scheme catalogue-health projection (Roadmap A.2 / E1) ----
  // Collision detection needs the fingerprint of every argument-pattern peer,
  // so load a lightweight (key, fingerprint) projection over the catalogue.
  let scheme: ArgumentAttestation["scheme"] = null;
  if (primarySchemeRow) {
    const sRow = primarySchemeRow.scheme as any;
    let catalogueHealth: CatalogueHealth | null = null;
    try {
      const peers = await prisma.argumentScheme.findMany({
        where: { kind: "argument-scheme" } as any,
        select: { key: true, fingerprint: true } as any,
      });
      const peerIndex = buildFingerprintPeerIndex(peers as any);
      catalogueHealth = computeCatalogueHealth(
        {
          key: sRow.key,
          kind: sRow.kind,
          clusterTag: sRow.clusterTag,
          fingerprint: sRow.fingerprint,
        },
        peerIndex,
      );
    } catch {
      catalogueHealth = null;
    }
    scheme = {
      id: sRow.id,
      key: sRow.key ?? null,
      name: sRow.name ?? null,
      title: sRow.title ?? null,
      canonicalKey: catalogueHealth?.canonicalKey ?? sRow.key ?? null,
      behaviourFingerprint: sRow.fingerprint ?? null,
      catalogueHealth,
    };
  }

  const criticalQuestionsRequired = primarySchemeRow?.scheme.cqs.length ?? 0;

  // ---- Dialectical pressure: CAs and ArgumentEdges targeting this argument ----
  // We pull the *rows* (not just counts) for inbound attacks/supports so we
  // can compute distinct-author depth (Track AI-EPI Pt. 3 §3) and last-seen
  // timestamps without an extra query round-trip.
  const conclusionClaimId = argument.conclusionClaimId;
  // Premise claim ids: an UNDERMINE targets a *premise* claim, so a CA whose
  // `conflictedClaimId` is one of these is a real attack on this argument and
  // must enter the standing/depth/fitness computation (mirrors the dialectical
  // layer's source-of-record — see lib/citations/argumentDialectic.ts). Prior
  // to this, premise undermines were invisible to standing.
  const premiseClaimIds = argument.premises
    .map((p) => p.claim?.id)
    .filter((id): id is string => !!id);
  const attackTargetClaimIds = [
    ...(conclusionClaimId ? [conclusionClaimId] : []),
    ...premiseClaimIds,
  ];
  const [
    incomingAttackCARows,
    incomingAttackEdgeFullRows,
    incomingSupportEdgeFullRows,
    cqStatusRows,
  ] = await Promise.all([
    prisma.conflictApplication.findMany({
      where: {
        OR: [
          { conflictedArgumentId: argument.id },
          attackTargetClaimIds.length
            ? { conflictedClaimId: { in: attackTargetClaimIds } }
            : undefined,
        ].filter(Boolean) as any[],
      },
      select: { createdById: true, createdAt: true },
      take: 500,
    }),
    prisma.argumentEdge.findMany({
      where: {
        toArgumentId: argument.id,
        type: { in: ["rebut", "undercut"] as any },
      },
      select: {
        createdById: true,
        createdAt: true,
        from: { select: { authorId: true } },
      },
      take: 500,
    }),
    prisma.argumentEdge.findMany({
      where: { toArgumentId: argument.id, type: "support" as any },
      select: {
        createdById: true,
        createdAt: true,
        from: { select: { authorId: true } },
      },
      take: 500,
    }),
    prisma.cQStatus.findMany({
      where: {
        OR: [
          { argumentId: argument.id },
          { targetType: "argument" as any, targetId: argument.id },
        ],
      },
      select: { statusEnum: true, status: true, schemeKey: true, cqKey: true, id: true, _count: { select: { attacks: true } } },
    }),
  ]);

  const incomingAttackCAs = incomingAttackCARows.length;
  const incomingAttackEdgeRows = incomingAttackEdgeFullRows.length;
  const incomingSupportEdgeRows = incomingSupportEdgeFullRows.length;
  const cqStatuses = cqStatusRows;

  const criticalQuestionsAnswered = cqStatuses.filter((s) => {
    const e = (s.statusEnum as unknown as string) || "";
    if (e === "ANSWERED" || e === "SATISFIED" || e === "RESOLVED") return true;
    const legacy = (s.status || "").toLowerCase();
    return legacy === "answered" || legacy === "satisfied" || legacy === "resolved";
  }).length;
  const criticalQuestionsOpen = Math.max(
    0,
    criticalQuestionsRequired - criticalQuestionsAnswered
  );

  const isTestedFlag = computeIsTested({
    criticalQuestionsAnswered,
    incomingAttacks: incomingAttackCAs,
    incomingSupports: incomingSupportEdgeRows,
  });

  const dialecticalStatus: DialecticalStatus = {
    incomingAttacks: incomingAttackCAs,
    incomingSupports: incomingSupportEdgeRows,
    incomingAttackEdges: incomingAttackEdgeRows,
    criticalQuestionsRequired,
    criticalQuestionsAnswered,
    criticalQuestionsOpen,
    standingScore: computeStandingScore({
      criticalQuestionsRequired,
      criticalQuestionsAnswered,
      incomingAttacks: incomingAttackCAs,
      incomingAttackEdges: incomingAttackEdgeRows,
      incomingSupports: incomingSupportEdgeRows,
    }),
    isTested: isTestedFlag,
    testedness: computeTestedness({
      criticalQuestionsAnswered,
      incomingAttacks: incomingAttackCAs,
      incomingSupports: incomingSupportEdgeRows,
      incomingAttackEdges: incomingAttackEdgeRows,
      isTested: isTestedFlag,
    }),
    standingState: computeStandingState({
      isTested: isTestedFlag,
      criticalQuestionsAnswered,
      incomingAttacks: incomingAttackCAs,
      incomingAttackEdges: incomingAttackEdgeRows,
      incomingSupports: incomingSupportEdgeRows,
    }),
    standingDepth: (() => {
      // Distinct authors, counted across edge-author and CA-creator. We
      // prefer the from-side argument author for support/attack edges (the
      // dialectical move belongs to that author, not the linker), and fall
      // back to `createdById` when the from-arg author is missing.
      const challengerAuthors = new Set<string>();
      for (const r of incomingAttackEdgeFullRows) {
        const a = r.from?.authorId ?? r.createdById ?? null;
        if (a) challengerAuthors.add(a);
      }
      for (const r of incomingAttackCARows) {
        if (r.createdById) challengerAuthors.add(r.createdById);
      }
      // Don't credit the argument's own author with reviewing themselves.
      if (argument.authorId) {
        challengerAuthors.delete(argument.authorId);
      }
      const reviewerAuthors = new Set<string>();
      for (const r of incomingSupportEdgeFullRows) {
        const a = r.from?.authorId ?? r.createdById ?? null;
        if (a) reviewerAuthors.add(a);
      }
      if (argument.authorId) {
        reviewerAuthors.delete(argument.authorId);
      }
      const allChallengeTimes = [
        ...incomingAttackEdgeFullRows.map((r) => r.createdAt),
        ...incomingAttackCARows.map((r) => r.createdAt),
      ].filter(Boolean) as Date[];
      const allDefenseTimes = incomingSupportEdgeFullRows
        .map((r) => r.createdAt)
        .filter(Boolean) as Date[];
      const lastChallenged = allChallengeTimes.length
        ? new Date(Math.max(...allChallengeTimes.map((d) => +new Date(d))))
        : null;
      const lastDefended = allDefenseTimes.length
        ? new Date(Math.max(...allDefenseTimes.map((d) => +new Date(d))))
        : null;
      return {
        challengers: challengerAuthors.size,
        independentReviewers: reviewerAuthors.size,
        lastChallengedAt: lastChallenged ? lastChallenged.toISOString() : null,
        lastDefendedAt: lastDefended ? lastDefended.toISOString() : null,
        confidence: classifyStandingConfidence({
          challengers: challengerAuthors.size,
          independentReviewers: reviewerAuthors.size,
        }),
      };
    })(),
    fitnessBreakdown: computeFitnessBreakdown({
      cqAnswered: criticalQuestionsAnswered,
      supportEdges: incomingSupportEdgeRows,
      attackEdges: incomingAttackEdgeRows,
      attackCAs: incomingAttackCAs,
      // Provenance-bearing evidence on the *conclusion* claim. Same rule
      // the search-route fitness uses, kept in lockstep via FITNESS_WEIGHTS.
      evidenceWithProvenance: (
        argument.conclusion?.ClaimEvidence ?? []
      ).filter((e: any) => !!e?.contentSha256).length,
    }),
  };

  // ---- Per-CQ aggregate (Track AI-EPI Pt. 3 §2) ---------------------------
  // For the primary scheme, project each catalog CQ into its current
  // status for this argument. CQs with no row are surfaced as "missing"
  // so consumers see the *gap*, not silence.
  let criticalQuestionsAggregate: CriticalQuestionsAggregate | null = null;
  if (primarySchemeRow) {
    const schemeKey = ((primarySchemeRow.scheme as any).key as string | null) ?? null;
    // ---- Answer-provenance nudge inputs (§12.1) -------------------------
    // Derive whether this argument's canonical CQ answers were self-asserted
    // by an AI agent over MCP. Same predicate as `isSelfCanonicalEligible`
    // (lib/cqs/answerOverMcp.ts) MINUS the session-match clause — here we only
    // care THAT it was AI-self-asserted, not whose session matched. Read off
    // the argument's own `authorKind` + `aiProvenance` (selected above).
    const answerAuthorKind: "HUMAN" | "AI" | "HYBRID" = (() => {
      const k =
        typeof (argument as any).authorKind === "string"
          ? (argument as any).authorKind
          : "HUMAN";
      return k === "AI" || k === "HYBRID" ? k : "HUMAN";
    })();
    const argProv = (argument as any).aiProvenance as Record<string, unknown> | null;
    const provVia =
      argProv && typeof argProv.via === "string" ? (argProv.via as string) : null;
    const answerSelfCanonical =
      (answerAuthorKind === "AI" || answerAuthorKind === "HYBRID") &&
      provVia != null &&
      provVia.startsWith("mcp");
    // Build a lookup keyed by cqKey (case-insensitive) over status rows
    // that match this scheme. We scope to the primary scheme so cross-
    // scheme CQ labels can't bleed into the aggregate.
    const statusByCqKey = new Map<string, typeof cqStatusRows[number]>();
    for (const s of cqStatusRows) {
      const sCqKey = (s as any).cqKey as string | null;
      const sSchemeKey = (s as any).schemeKey as string | null;
      if (!sCqKey) continue;
      if (schemeKey && sSchemeKey && sSchemeKey !== schemeKey) continue;
      statusByCqKey.set(sCqKey.toLowerCase(), s);
    }
    const projected: CriticalQuestionStatus[] = primarySchemeRow.scheme.cqs.map(
      (cq: any) => {
        const key = (cq.cqKey ?? cq.id ?? "").toString();
        const row = key ? statusByCqKey.get(key.toLowerCase()) : undefined;
        const e = ((row?.statusEnum as unknown as string) || "").toUpperCase();
        const legacy = (row?.status || "").toLowerCase();
        let status: CriticalQuestionStatus["status"];
        if (!row) status = "missing";
        else if (e === "SATISFIED" || legacy === "satisfied" || legacy === "resolved") status = "satisfied";
        else if (e === "PARTIALLY_SATISFIED" || legacy === "partially_satisfied") status = "partially_satisfied";
        else if (e === "PENDING_REVIEW" || legacy === "pending_review") status = "pending_review";
        else if (e === "DISPUTED" || legacy === "disputed") status = "disputed";
        else status = "open";
        // Derived premise-classification fields (Roadmap A.2). `premiseType`
        // is a shipped column; the two booleans are derived exactly as in the
        // E2 obligation projection so the two surfaces never drift.
        const rawPremiseType =
          typeof cq.premiseType === "string" ? cq.premiseType : null;
        const premiseType =
          rawPremiseType === "ORDINARY" ||
          rawPremiseType === "ASSUMPTION" ||
          rawPremiseType === "EXCEPTION"
            ? rawPremiseType
            : null;
        const cqSchemeId = cq.schemeId ?? null;
        const rawStatusEnum = ((row?.statusEnum as unknown as string) || "").toUpperCase();
        const cqStatusEnum =
          rawStatusEnum === "OPEN" ||
          rawStatusEnum === "PENDING_REVIEW" ||
          rawStatusEnum === "PARTIALLY_SATISFIED" ||
          rawStatusEnum === "SATISFIED" ||
          rawStatusEnum === "DISPUTED"
            ? (rawStatusEnum as CriticalQuestionStatus["cqStatusEnum"])
            : null;
        const challengeCount = (row as any)?._count?.attacks ?? 0;
        const rawBurden =
          typeof cq.burdenOfProof === "string" ? cq.burdenOfProof.toUpperCase() : null;
        const cqBurden =
          rawBurden === "PROPONENT" ||
          rawBurden === "CHALLENGER" ||
          rawBurden === "OPPONENT"
            ? (rawBurden as CriticalQuestionStatus["cqBurden"])
            : "PROPONENT";
        return {
          cqKey: key,
          text: (cq.text ?? "").toString(),
          attackKind: cq.attackKind ?? null,
          cqStatusId: row?.id ?? null,
          schemeKey,
          premiseType,
          isSchemeRequired: premiseType !== "ASSUMPTION",
          inheritedFromParentScheme:
            cqSchemeId != null && cqSchemeId !== primarySchemeRow.scheme.id,
          cqStatusEnum,
          challenged: challengeCount > 0,
          challengeCount,
          cqRequiresEvidence: cq.requiresEvidence === true,
          cqBurden,
          answerSelfCanonical,
          answerAuthorKind,
          status,
        };
      },
    );
    criticalQuestionsAggregate = {
      schemeKey,
      total: projected.length,
      answered: projected.filter((p) => p.status === "satisfied"),
      partiallyAnswered: projected.filter(
        (p) => p.status === "partially_satisfied" || p.status === "pending_review",
      ),
      unanswered: projected.filter(
        (p) => p.status === "missing" || p.status === "open" || p.status === "disputed",
      ),
    };
  }

  // ---- Play-time SchemeInstance protocol state (Roadmap A.2 / E2) ----------
  // The obligation apparatus materialises a `SchemeInstance` on the argument's
  // conclusion claim for the primary scheme. Project its open/discharged
  // obligations and close-hook eligibility, reusing the exact shape served by
  // `GET /api/scheme-instances/[id]/state`. Best-effort: a missing instance
  // (argument predates the apparatus, or carries no scheme) yields `null`.
  let schemeInstance: SchemeInstanceStateProjection | null = null;
  if (primarySchemeRow && conclusionClaimId) {
    try {
      const instanceRow = await prisma.schemeInstance.findFirst({
        where: {
          targetType: "claim",
          targetId: conclusionClaimId,
          schemeId: (primarySchemeRow.scheme as any).id as string,
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      if (instanceRow) {
        const projection = await projectSchemeInstanceState(instanceRow.id);
        schemeInstance = "error" in projection ? null : projection;
      }
    } catch {
      schemeInstance = null;
    }
  }

  // ---- Author lookup (best-effort; non-fatal) ----
  // Argument.authorId is a Firebase auth_id string. Resolve via User.auth_id.
  // We also pull AuthorKind / aiProvenance off the Argument row when the
  // generated Prisma client carries them (Track AI-EPI Pt. 3 §5). Both
  // fields default to HUMAN/null on the schema, so older clients pre-
  // migration just see HUMAN authors.
  let author: ArgumentAttestation["author"] = null;
  // Read authorKind / aiProvenance off the source row in a forward-
  // compatible way (the fields exist on schema; cast to `any` so this file
  // doesn't fail to compile if the generated client is momentarily stale).
  const argRowAny = argument as any;
  const rawAuthorKind: string =
    typeof argRowAny.authorKind === "string" ? argRowAny.authorKind : "HUMAN";
  const authorKind: AuthorKind =
    rawAuthorKind === "AI" || rawAuthorKind === "HYBRID" ? rawAuthorKind : "HUMAN";
  const aiProvenance =
    authorKind === "HUMAN"
      ? null
      : (argRowAny.aiProvenance as Record<string, unknown> | null) ?? null;
  if (argument.authorId) {
    try {
      const u = await prisma.user.findUnique({
        where: { auth_id: argument.authorId },
        select: { name: true, username: true },
      });
      author = {
        id: argument.authorId,
        displayName: u ? u.name || u.username || null : null,
        kind: authorKind,
        aiProvenance,
      };
    } catch {
      author = {
        id: argument.authorId,
        displayName: null,
        kind: authorKind,
        aiProvenance,
      };
    }
  } else if (authorKind !== "HUMAN") {
    // AI-authored row with no human author at all—still surface the kind.
    author = {
      id: null,
      displayName: null,
      kind: authorKind,
      aiProvenance,
    };
  }

  const evidence: EvidenceProvenance[] = (argument.conclusion?.ClaimEvidence ?? []).map(
    (e: any) => ({
      evidenceId: e.id,
      uri: e.uri ?? null,
      title: e.title ?? null,
      citation: e.citation ?? null,
      contentSha256: e.contentSha256 ?? null,
      archivedUrl: e.archivedUrl ?? null,
      archivedAt: e.archivedAt ? new Date(e.archivedAt).toISOString() : null,
    })
  );

  // Canonical CitationBlock projection (Track AI-EPI Pt. 3 §7). Mirrors
  // `evidence` 1:1; the dual-shape lets older consumers read `evidence`
  // while new ones (UIs, MCP) prefer `structuredCitations`.
  const structuredCitations: CitationBlock[] = (
    argument.conclusion?.ClaimEvidence ?? []
  ).map((e: any) => toCitationBlock(e));

  const conclusion = argument.conclusion
    ? {
        claimId: argument.conclusion.id,
        moid: argument.conclusion.moid ?? null,
        text: argument.conclusion.text ?? "",
      }
    : null;

  const premises = argument.premises.map((p) => ({
    claimId: p.claim.id,
    moid: p.claim.moid ?? null,
    text: p.claim.text ?? "",
    isImplicit: !!p.isImplicit,
  }));

  // ---- Canonical payload + content hash ----
  // We hash a *minimal, stable* projection: the conclusion text + ordered
  // premise MOIDs (or claim ids if MOID missing) + scheme key + ordered
  // evidence URIs + permalink version. This keeps the hash robust to
  // cosmetic reorderings while changing whenever the *substance* changes.
  const canonicalShape = {
    v: 1,
    permalinkVersion: argument.permalink?.version ?? 1,
    conclusion: conclusion?.text ?? null,
    conclusionMoid: conclusion?.moid ?? null,
    premises: premises.map((p) => ({
      moid: p.moid ?? p.claimId,
      text: p.text,
      isImplicit: p.isImplicit,
    })),
    schemeKey: scheme?.key ?? null,
    evidence: evidence.map((e) => ({
      uri: e.uri,
      title: e.title,
      sha256: e.contentSha256,
    })),
  };
  const canonicalPayload = canonicalStringify(canonicalShape);
  const contentHash = sha256(canonicalPayload);

  const permalink = `${BASE_URL}/a/${identifier}`;
  const immutablePermalink = `${permalink}@${contentHash.replace("sha256:", "")}`;
  // E.2: deterministic URN. We use the resolved permalink shortCode when
  // available so every iso: id resolves through the canonical short URL;
  // fall back to the raw identifier (which is itself the shortCode for any
  // argument that has a permalink row, or the argument id otherwise).
  const isoShortCode = argument.permalink?.shortCode ?? identifier;
  const isoId = toIsoId("argument", isoShortCode);
  const isoUrl = toIsoUrl("argument", isoShortCode);

  return {
    identifier,
    argumentId: argument.id,
    permalink,
    version: argument.permalink?.version ?? 1,
    contentHash,
    immutablePermalink,
    isoId,
    isoUrl,
    doi: null,
    retrievedAt: new Date().toISOString(),
    createdAt: argument.createdAt ? argument.createdAt.toISOString() : null,
    updatedAt: argument.lastUpdatedAt ? argument.lastUpdatedAt.toISOString() : null,
    conclusion,
    premises,
    scheme,
    evidence,
    structuredCitations,
    criticalQuestions: criticalQuestionsAggregate,
    schemeInstance,
    confidence:
      argument.confidence !== null && argument.confidence !== undefined
        ? Number(argument.confidence)
        : null,
    dialecticalStatus,
    deliberation: argument.deliberation
      ? {
          id: argument.deliberation.id,
          title: argument.deliberation.title ?? null,
        }
      : null,
    author,
    canonicalPayload,
  };
}

// ============================================================
// CONVENIENCE
// ============================================================

/**
 * Convenience helper that returns just the public-facing summary used by
 * cite-style tools (omits the canonicalPayload to keep responses tight).
 */
export function toAttestationSummary(att: ArgumentAttestation) {
  const { canonicalPayload, ...rest } = att;
  return rest;
}

/**
 * Build a **signed** attestation envelope (Track AI-EPI Pt. 5 §1, the `?signed=1`
 * surface). Signs the attestation summary with the platform-witness key so a
 * third party can verify authenticity offline against `/.well-known/issuer-keys`
 * — no call back to Isonomia required.
 *
 * v1 signs with the **platform-witness** key: the envelope's meaningful fields
 * (standing, critical-question counts) are graph-derived, which the platform
 * witnesses and an author cannot personally vouch for. Per-author signing
 * (`loadActiveSigningKey`) plugs in here once author-key provisioning ships.
 *
 * Throws if no signing key can be obtained (e.g. neither KMS nor
 * `MESH_EXPORT_SECRET_KEY` is configured) — callers should surface that as a
 * "signing not configured" error rather than silently returning an unsigned body.
 */
export async function buildSignedAttestationEnvelope(
  att: ArgumentAttestation,
): Promise<SignedAttestationEnvelope> {
  const key = await loadPlatformWitnessKey();
  const signed = signSummaryEnvelope(
    toAttestationSummary(att) as Record<string, unknown>,
    key,
  );
  // Revocation stamp (Track AI-EPI Pt. 5 §3). The signed bytes are unchanged —
  // `status`/`revocationReason` are advisory metadata on the signature block,
  // NOT covered by the signature. The *authoritative* revocation check is the
  // append-only `/.well-known/revoked-attestations` list; this stamp is a hint so
  // a consumer sees the revocation without a second fetch. We never delete or
  // refuse to serve a revoked envelope (hard invariant: downstream citations must
  // see the revocation, not a vanished artifact).
  const revoked = await prisma.revokedAttestation.findUnique({
    where: {
      shortCode_contentHash: {
        shortCode: att.identifier,
        contentHash: att.contentHash,
      },
    },
    select: { reason: true },
  });
  if (revoked) {
    signed.signature.status = "revoked";
    signed.signature.revocationReason = revoked.reason;
  }
  return signed;
}
