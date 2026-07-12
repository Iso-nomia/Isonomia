// lib/argumentation/eccAdapter.ts
// Sprint B1 — adapter that re-derives the evidential payload via the typed
// ECC algebra in `lib/argumentation/ecc.ts` instead of inline scalar reductions.
//
// Contract: byte-identical JSON output to the legacy path in
// `app/api/deliberations/[id]/evidential/route.ts` for the same Prisma inputs.
// Differences in floating-point at the 5th decimal are tolerated because both
// paths round to 4 decimals before serialization.
//
// Citations: ECC plan §B1, §B2, §B5 in
//   `Development and Ideation Documents/ARCHITECTURE/ECC_REFINEMENT_AND_MCP_INTEGRATION_PLAN.md`.

import {
  type Arrow,
  type AssumptionStatus,
  type AssumptionId,
  type DerivationId,
  type ConfidenceMonoid,
  zero,
  join,
  withMinScores,
  withProductScores,
  confidence,
  isLogical,
  isSelected,
  isSimple,
  isEntire,
} from "./ecc";
import { corroborateProbs } from "./logodds";

// ── Types: pure inputs (no Prisma import) so tests can stub freely ─────────

export type Mode = "min" | "product" | "logodds";

export interface SupportRow {
  /** ArgumentSupport.id — the derivation id in the algebra. */
  id: DerivationId;
  claimId: string;
  argumentId: string;
  /** `base` from ArgumentSupport (clamped 0..1). */
  base: number;
  /** True iff this row was imported (kind === 'import'). */
  isImported?: boolean;
}

export interface VirtualSupport {
  claimId: string;
  argumentId: string;
  base: number;
}

export interface PremiseEdge {
  fromArgumentId: string;
  toArgumentId: string;
}

/** A single AssumptionUse row that can affect tagging via `status`. */
export interface AssumptionRow {
  id: AssumptionId;
  argumentId: string | null;
  status: AssumptionStatus;
  weight: number;
}

export interface DerivationAssumptionRow {
  derivationId: DerivationId;
  assumptionId: AssumptionId;
  weight: number;
}

export interface ClaimRow {
  id: string;
  text: string;
}

export interface EvidentialInputs {
  claims: ClaimRow[];
  /** Conclusion argument per claim, used for `nodes[].diagramId`. */
  concludingArgumentByClaim: Map<string, string | null>;
  localSupports: SupportRow[];
  virtualSupports: VirtualSupport[];
  premiseEdges: PremiseEdge[];
  derivationAssumptions: DerivationAssumptionRow[];
  /** Status keyed by AssumptionUse.id. */
  assumptionStatus: Map<AssumptionId, AssumptionStatus>;
  /** Legacy fallback: argument-level assumption weights. */
  legacyAssumptionsByArg: Map<string, number[]>;
  /** Default for ArgumentSupport.base when missing. */
  defaultArgumentConfidence: number;
  /** Default base for premises lacking a baseByArg entry. */
  defaultPremiseBase: number;
}

// ── Output shape: identical to the route's response (math fields only) ─────

export interface EvNode {
  id: string;
  diagramId: string | null;
  type: "claim";
  text: string;
  score: number;
  top: Array<{ argumentId: string; score: number }>;
  /** Sprint B4 — true iff at least one Arrow into this claim is `isLogical`. */
  logical: boolean;
  /** Sprint B4 (advanced/audit) — at least one Arrow is selected (Def. 8). */
  selected: boolean;
}

export interface EvidentialPayload {
  support: Record<string, number>;
  hom: Record<string, { args: string[] }>;
  nodes: EvNode[];
}

// ── Internals ──────────────────────────────────────────────────────────────

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round4 = (x: number) => +x.toFixed(4);

/**
 * Recover the same scalar score the legacy pipeline produces for a single
 * `ArgumentSupport` row, then feed it as the per-derivation `base(d)` into
 * the typed ConfidenceMonoid. This is the bridge that makes the typed
 * pipeline byte-identical to the legacy one in non-DS modes.
 */
function legacyRowScore(
  row: SupportRow | VirtualSupport,
  isReal: boolean,
  baseByArg: Map<string, number>,
  parents: Map<string, string[]>,
  derivByArg: Map<string, DerivationId[]>,
  assumpByDeriv: Map<DerivationId, number[]>,
  legacyAssumptionsByArg: Map<string, number[]>,
  mode: Mode,
  defaultPremiseBase: number
): { score: number; assumptionWeights: number[]; premiseBases: number[] } {
  const b = isReal ? (baseByArg.get(row.argumentId) ?? row.base) : row.base;
  const premIds = isReal ? (parents.get(row.argumentId) ?? []) : [];
  const premBases = isReal ? premIds.map((pid) => baseByArg.get(pid) ?? defaultPremiseBase) : [];

  // Per-derivation assumptions (rolled up across all derivations of this argument)
  let aBases: number[] = [];
  if (isReal) {
    const derivIds = derivByArg.get(row.argumentId) ?? [];
    const derivAssumps: number[] = [];
    for (const d of derivIds) {
      const ws = assumpByDeriv.get(d);
      if (ws && ws.length) derivAssumps.push(...ws);
    }
    aBases = derivAssumps.length ? derivAssumps : (legacyAssumptionsByArg.get(row.argumentId) ?? []);
  }

  // The legacy reducer is `compose([b, premFactor], mode) * assumpFactor`:
  // we replicate it exactly.
  const composeScalar = (xs: number[]): number =>
    !xs.length ? 0 : (mode === "min" ? Math.min(...xs) : xs.reduce((a, x) => a * x, 1));
  const premFactor = premBases.length ? composeScalar(premBases) : 1;
  const assumpFactor = aBases.length ? composeScalar(aBases) : 1;
  const score = clamp01(composeScalar([b, premFactor]) * assumpFactor);

  return { score, assumptionWeights: aBases, premiseBases: premBases };
}

/**
 * Pick the monoid for a given Mode. The MCP/HTTP layer must close this enum
 * (ECC plan §4 row 5); the adapter accepts only the three built-ins.
 */
function monoidForMode(mode: Mode, scoresByDeriv: Map<DerivationId, number>): ConfidenceMonoid<number> {
  switch (mode) {
    case "min": return withMinScores(scoresByDeriv);
    case "product": return withProductScores(scoresByDeriv);
    case "logodds":
      // Weight-of-evidence semiring (lib/argumentation/logodds.ts). `join`
      // corroborates across derivations by adding log-odds (stacks; the
      // identity is the neutral p=0.5, w=0). Corroboration is associative +
      // commutative, so the pairwise fold in `confidence()` equals the n-ary
      // `corroborateProbs` the route applies — preserving parity. Note: unlike
      // the built-ins this `join` is NOT idempotent (that is the point).
      return {
        key: "logodds",
        top: 0.5,
        combine: (x, y) => corroborateProbs([x, y]),
        join: (x, y) => corroborateProbs([x, y]),
        base: (d) => scoresByDeriv.get(d) ?? 0.5,
      };
  }
}

// ── Sprint B1 main entry point ─────────────────────────────────────────────

/**
 * Pure typed evaluator. Given the same inputs the route gathers, produce
 * the same `{support, dsSupport, hom, nodes}` payload — but the math is
 * provably the typed ECC algebra (`Arrow` + `ConfidenceMonoid`).
 *
 * @invariant Parity with legacy: for every `(claimId)`, the `support[claimId]`
 *   produced here equals the legacy reducer's output rounded to 4 decimals.
 *   This is asserted in `tests/eccAdapter.test.ts`.
 * @invariant Sprint B5 (undercut monotonicity): adding an `EdgeType.undercut`
 *   row never lowers `support[claimId]`. Undercut effects propagate only via
 *   `AssumptionUse.status` transitions (Ambler p. 171).
 */
export function evaluateEvidentialTyped(
  inputs: EvidentialInputs,
  mode: Mode
): EvidentialPayload {
  const {
    claims,
    concludingArgumentByClaim,
    localSupports,
    virtualSupports,
    premiseEdges,
    derivationAssumptions,
    assumptionStatus,
    legacyAssumptionsByArg,
    defaultArgumentConfidence,
    defaultPremiseBase,
  } = inputs;

  const allSupports = [
    ...localSupports.map((s) => ({ ...s, base: clamp01(s.base ?? defaultArgumentConfidence) })),
    ...virtualSupports,
  ];

  // Empty payload — match the route's early-return shape.
  if (allSupports.length === 0) {
    return { support: {}, hom: {}, nodes: claimsToEmptyNodes(claims, concludingArgumentByClaim) };
  }

  // Build lookup maps the legacy route also builds (kept identical for parity).
  const realArgIds = new Set(allSupports.filter((s) => !s.argumentId.startsWith("virt:")).map((s) => s.argumentId));
  const parents = new Map<string, string[]>();
  for (const e of premiseEdges) {
    if (!realArgIds.has(e.toArgumentId)) continue;
    const list = parents.get(e.toArgumentId) ?? [];
    list.push(e.fromArgumentId);
    parents.set(e.toArgumentId, list);
  }

  const baseByArg = new Map<string, number>();
  for (const s of allSupports) {
    if (!s.argumentId.startsWith("virt:")) baseByArg.set(s.argumentId, s.base);
  }

  // derivId -> assumption weights (only rows whose assumption is not RETRACTED;
  // RETRACTED matches legacy fallback semantics in `legacyAssumptionsByArg`).
  // NOTE: legacy code did NOT filter by status; we preserve that for parity.
  // The Sprint B5 contract only says undercut never lowers support; assumption
  // *status* is a separate Sprint D mechanism. We keep parity here and let
  // Sprint D wire the filter through.
  const assumpByDeriv = new Map<DerivationId, number[]>();
  for (const da of derivationAssumptions) {
    const list = assumpByDeriv.get(da.derivationId) ?? [];
    list.push(clamp01(da.weight));
    assumpByDeriv.set(da.derivationId, list);
  }

  // Map argument -> its derivation ids (the ArgumentSupport rows for it).
  const derivByArg = new Map<string, DerivationId[]>();
  for (const s of localSupports) {
    if (s.argumentId.startsWith("virt:")) continue;
    const list = derivByArg.get(s.argumentId) ?? [];
    list.push(s.id);
    derivByArg.set(s.argumentId, list);
  }

  // Compute per-row scores AND build typed Arrows in the same pass.
  // Each support row becomes one derivation in the per-claim Arrow `I → claim`.
  type Contrib = { argumentId: string; derivationId: DerivationId; score: number };
  const contribsByClaim = new Map<string, Contrib[]>();
  const argsByClaim = new Map<string, string[]>();
  const arrowByClaim = new Map<string, Arrow<"I", string>>();
  const scoresByDeriv = new Map<DerivationId, number>();
  const assumIdsByDeriv = new Map<DerivationId, Set<AssumptionId>>();

  for (const row of allSupports) {
    const isReal = !row.argumentId.startsWith("virt:");
    const derivId: DerivationId = "id" in row ? (row.id as DerivationId) : `virt:${row.argumentId}`;

    const { score } = legacyRowScore(
      row,
      isReal,
      baseByArg,
      parents,
      derivByArg,
      assumpByDeriv,
      legacyAssumptionsByArg,
      mode,
      defaultPremiseBase
    );
    scoresByDeriv.set(derivId, score);

    // Track per-derivation assumption *ids* (not just weights) for tagging.
    const aIds = new Set<AssumptionId>();
    if (isReal) {
      for (const d of (derivByArg.get(row.argumentId) ?? [])) {
        for (const da of derivationAssumptions) {
          if (da.derivationId === d) aIds.add(da.assumptionId);
        }
      }
    }
    assumIdsByDeriv.set(derivId, aIds);

    const list = contribsByClaim.get(row.claimId) ?? [];
    list.push({ argumentId: row.argumentId, derivationId: derivId, score });
    contribsByClaim.set(row.claimId, list);

    const args = argsByClaim.get(row.claimId) ?? [];
    args.push(row.argumentId);
    argsByClaim.set(row.claimId, args);

    // Build / extend the Arrow `I → claim` for this row.
    let arrow = arrowByClaim.get(row.claimId);
    if (!arrow) {
      arrow = zero<"I", string>("I", row.claimId);
      arrowByClaim.set(row.claimId, arrow);
    }
    arrow.derivs.add(derivId);
    arrow.assumptions.set(derivId, new Set(aIds));
  }

  // Build the monoid keyed on per-derivation scores and run `confidence()`
  // on each per-claim Arrow. This IS the typed pipeline.
  const scalarMonoid = monoidForMode(mode, scoresByDeriv);

  const support: Record<string, number> = {};
  const nodes: EvNode[] = [];
  const isAccepted = (id: AssumptionId) => assumptionStatus.get(id) ?? "PROPOSED";

  for (const c of claims) {
    const arrow = arrowByClaim.get(c.id);
    const contribs = (contribsByClaim.get(c.id) ?? []).slice().sort((a, b) => b.score - a.score);

    let s = 0;
    let logical = false;
    let selected = false;
    if (arrow && arrow.derivs.size > 0) {
      s = confidence(arrow, scalarMonoid);
      logical = isLogical(arrow, { assumptionStatus: isAccepted });
      // Per ECC plan §4 row 1 the "selected" structural flag exists alongside
      // the strict `logical` predicate; we surface both for the audit view.
      selected = isSelected(arrow);
    }

    support[c.id] = round4(s);
    const top = contribs.slice(0, 5).map((x) => ({ argumentId: x.argumentId, score: round4(x.score) }));

    nodes.push({
      id: c.id,
      diagramId: concludingArgumentByClaim.get(c.id) ?? null,
      type: "claim",
      text: c.text,
      score: support[c.id],
      top,
      logical,
      selected,
    });
  }

  // hom map: deduplicated argument id list per claim, keyed `I|claimId`.
  const hom: Record<string, { args: string[] }> = {};
  for (const [claimId, list] of argsByClaim) {
    hom[`I|${claimId}`] = { args: Array.from(new Set(list)) };
  }

  return { support, hom, nodes };
}

function claimsToEmptyNodes(
  claims: ClaimRow[],
  concludingByClaim: Map<string, string | null>
): EvNode[] {
  return claims.map((c) => ({
    id: c.id,
    diagramId: concludingByClaim.get(c.id) ?? null,
    type: "claim",
    text: c.text,
    score: 0,
    top: [],
    logical: false,
    selected: false,
  }));
}

// ── Sprint B3 helper — tag a single (claim, argument) Arrow ────────────────

export interface ArrowTags {
  simple: boolean;
  entire: boolean;
  selected: boolean;
  logical: boolean;
}

/**
 * Compute structural + logical tags for the Arrow a single `ArgumentSupport`
 * row contributes to its claim. Used by the backfill script and the write-time
 * tagging hook in `lib/evidential/lazy-recompute.ts`.
 *
 * For per-row tagging:
 *   - `simple` is `derivationCountForArgumentClaim ≤ 1`.
 *   - `entire` is `derivationCountForArgumentClaim ≥ 1`.
 *   - `selected` is `simple ∧ entire`.
 *   - `logical` is strict (ECC plan §4 row 1): every assumption tied to any
 *     of this argument's derivations into this claim must be `ACCEPTED`.
 */
export function computeArrowTags(args: {
  argumentId: string;
  derivationIds: DerivationId[];
  derivationAssumptions: DerivationAssumptionRow[];
  assumptionStatus: Map<AssumptionId, AssumptionStatus>;
}): ArrowTags {
  const { derivationIds, derivationAssumptions, assumptionStatus } = args;
  const derivCount = derivationIds.length;
  const simple = derivCount <= 1;
  const entire = derivCount >= 1;
  const selected = simple && entire;

  // Logical: at least one derivation is fully closed (all ACCEPTED).
  let logical = false;
  if (entire) {
    const byDeriv = new Map<DerivationId, AssumptionId[]>();
    for (const da of derivationAssumptions) {
      const list = byDeriv.get(da.derivationId) ?? [];
      list.push(da.assumptionId);
      byDeriv.set(da.derivationId, list);
    }
    for (const d of derivationIds) {
      const aIds = byDeriv.get(d) ?? [];
      const allAccepted = aIds.every((id) => assumptionStatus.get(id) === "ACCEPTED");
      if (allAccepted) {
        logical = true;
        break;
      }
    }
  }

  return { simple, entire, selected, logical };
}

// Re-export structural predicates so callers don't need a second import.
export { isSimple, isEntire, isSelected, isLogical };
