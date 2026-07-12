/**
 * Chain scope resolver — PART 5 (CHAIN_SEMANTICS_OVER_MCP_SPEC.md §4.1–4.4).
 *
 * Pure, side-effect-free functions that turn a chain's declared `scopes[]` plus
 * per-link scope/status/role assignments into:
 *   - a resolved, validated scope forest (depth computed, nesting checked),
 *   - a per-link resolution: the node's `epistemicStatus`, `dialecticalRole`,
 *     resolved `scopeIndex`, and the scope-forced `coercedMode` (§4.4), and
 *   - any advisory warnings (`scope_empty`).
 *
 * The two honesty guarantees this layer adds (§1):
 *   - **scope containment** (`SCOPE_LEAK`): a conclusion drawn inside a
 *     supposition may not be threaded as an asserted premise outside it; and
 *   - **status/scope reconciliation** (`SCOPE_STATUS_CONFLICT`): an asserted
 *     claim cannot live inside a contrary-to-fact (or any) supposition.
 *
 * The route maps scope indices → real `ArgumentScope` ids after creating the
 * scope rows; this module never touches the database. Mode coercion is decided
 * here (the `coercedMode` target) but applied by the route against the
 * scheme-gate-resolved per-link mode (which the module does not see).
 *
 * Step 1 scope (this file): scope authoring + nesting + containment validator;
 * per-node status/role; reconciliation with the per-link epistemic mode (§4.4).
 * Per-link evidence (Citation anchors/intent) is PART 5 Step 3 and lives apart.
 */

export const SCOPE_TYPES = [
  "HYPOTHETICAL",
  "COUNTERFACTUAL",
  "CONDITIONAL",
  "OPPONENT",
  "MODAL",
] as const;

export type ScopeType = (typeof SCOPE_TYPES)[number];

export const EPISTEMIC_STATUSES = [
  "ASSERTED",
  "HYPOTHETICAL",
  "COUNTERFACTUAL",
  "CONDITIONAL",
  "QUESTIONED",
  "DENIED",
  "SUSPENDED",
] as const;

export type EpistemicStatus = (typeof EPISTEMIC_STATUSES)[number];

export const DIALECTICAL_ROLES = [
  "THESIS",
  "ANTITHESIS",
  "SYNTHESIS",
  "OBJECTION",
  "RESPONSE",
  "CONCESSION",
] as const;

export type DialecticalRole = (typeof DIALECTICAL_ROLES)[number];

export type EpistemicMode = "FACTUAL" | "HYPOTHETICAL" | "COUNTERFACTUAL";

/** v1 nesting cap (§4.2): a scope's depth may not exceed this. Root = 0. */
export const MAX_SCOPE_DEPTH = 4;

/** scope-type → the default node `epistemicStatus` (§4.4 table). */
const SCOPE_DEFAULT_STATUS: Record<ScopeType, EpistemicStatus> = {
  HYPOTHETICAL: "HYPOTHETICAL",
  COUNTERFACTUAL: "COUNTERFACTUAL",
  CONDITIONAL: "CONDITIONAL",
  OPPONENT: "HYPOTHETICAL",
  MODAL: "HYPOTHETICAL",
};

/** scope-type → forced argument `epistemicMode` (§4.4 table); null = as supplied. */
const SCOPE_COERCED_MODE: Record<ScopeType, EpistemicMode | null> = {
  HYPOTHETICAL: "HYPOTHETICAL",
  COUNTERFACTUAL: "COUNTERFACTUAL",
  CONDITIONAL: null,
  OPPONENT: "HYPOTHETICAL",
  MODAL: null,
};

/** Statuses allowed inside any scope and leaving the mode as supplied (§4.4). */
const PERMISSIVE_STATUSES = new Set<EpistemicStatus>([
  "CONDITIONAL",
  "QUESTIONED",
  "SUSPENDED",
]);

export interface ScopeInput {
  scopeType: ScopeType;
  assumption: string;
  description?: string;
  parentScope?: number;
}

export interface ScopeLinkInput {
  scope?: number;
  epistemicStatus?: EpistemicStatus;
  dialecticalRole?: DialecticalRole;
}

export interface ScopeSupportEdge {
  from: number;
  to: number;
}

export interface ResolvedScope {
  index: number;
  scopeType: ScopeType;
  assumption: string;
  description?: string;
  parentIndex: number | null;
  depth: number;
}

export interface ResolvedScopeLink {
  scopeIndex: number | null;
  epistemicStatus: EpistemicStatus;
  dialecticalRole: DialecticalRole | null;
  /** Scope-forced argument mode (§4.4); null = leave the supplied mode as-is. */
  coercedMode: EpistemicMode | null;
}

export interface ScopeWarning {
  code: string;
  detail: string;
}

export type ScopeResult =
  | {
      ok: true;
      resolvedScopes: ResolvedScope[];
      links: ResolvedScopeLink[];
      warnings: ScopeWarning[];
    }
  | {
      ok: false;
      code:
        | "SCOPE_INVALID_INDEX"
        | "SCOPE_CYCLE_DETECTED"
        | "SCOPE_TOO_DEEP"
        | "SCOPE_LEAK"
        | "SCOPE_STATUS_CONFLICT";
      detail: string;
      linkIndex?: number;
    };

/**
 * Resolve and validate a chain's scope structure.
 *
 * @param scopes       declared scopes; omit ⇒ pure PART-3 actual world
 * @param links        per-link scope/status/role assignments, index-aligned to
 *                     the chain's links
 * @param supportEdges the resolved SUPPORT edges (in link-index space) over
 *                     which containment is checked — attack edges are excluded
 */
export function resolveChainScopes(opts: {
  scopes?: ScopeInput[];
  links: ScopeLinkInput[];
  supportEdges: ScopeSupportEdge[];
}): ScopeResult {
  const scopes = opts.scopes ?? [];
  const { links, supportEdges } = opts;
  const warnings: ScopeWarning[] = [];

  // 1. Validate parentScope indices (range + no self-parent).
  const parentIndex: (number | null)[] = scopes.map((s) => s.parentScope ?? null);
  for (let i = 0; i < scopes.length; i++) {
    const p = parentIndex[i];
    if (p === null) continue;
    if (!Number.isInteger(p) || p < 0 || p >= scopes.length) {
      return {
        ok: false,
        code: "SCOPE_INVALID_INDEX",
        detail: `Scope ${i}: parentScope ${p} is out of range [0, ${scopes.length - 1}].`,
      };
    }
    if (p === i) {
      return {
        ok: false,
        code: "SCOPE_CYCLE_DETECTED",
        detail: `Scope ${i} is its own parent.`,
      };
    }
  }

  // 2. Forest / cycle check + depth computation (root = 0, child = parent + 1).
  const depth: number[] = new Array(scopes.length).fill(-1);
  const computeDepth = (i: number, seen: Set<number>): number | null => {
    if (depth[i] >= 0) return depth[i];
    if (seen.has(i)) return null; // cycle
    seen.add(i);
    const p = parentIndex[i];
    if (p === null) {
      depth[i] = 0;
      return 0;
    }
    const pd = computeDepth(p, seen);
    if (pd === null) return null;
    depth[i] = pd + 1;
    return depth[i];
  };
  for (let i = 0; i < scopes.length; i++) {
    const d = computeDepth(i, new Set());
    if (d === null) {
      return {
        ok: false,
        code: "SCOPE_CYCLE_DETECTED",
        detail: `Scope ${i}: parentScope references form a cycle.`,
      };
    }
    if (d > MAX_SCOPE_DEPTH) {
      return {
        ok: false,
        code: "SCOPE_TOO_DEEP",
        detail: `Scope ${i}: nesting depth ${d} exceeds the v1 cap of ${MAX_SCOPE_DEPTH}.`,
      };
    }
  }

  // 3. Validate per-link scope indices; reconcile status/role/mode (§4.4).
  const resolvedLinks: ResolvedScopeLink[] = [];
  const usedScopes = new Set<number>();
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const si = link.scope;
    if (si !== undefined) {
      if (!Number.isInteger(si) || si < 0 || si >= scopes.length) {
        return {
          ok: false,
          code: "SCOPE_INVALID_INDEX",
          detail: `Link ${i + 1}: scope ${si} is out of range [0, ${scopes.length - 1}].`,
          linkIndex: i,
        };
      }
      usedScopes.add(si);
    }

    const scopeType = si !== undefined ? scopes[si].scopeType : null;
    const defaultStatus: EpistemicStatus = scopeType
      ? SCOPE_DEFAULT_STATUS[scopeType]
      : "ASSERTED";
    const explicit = link.epistemicStatus;

    if (explicit && si !== undefined) {
      // An asserted claim cannot live inside any supposition.
      if (explicit === "ASSERTED") {
        return {
          ok: false,
          code: "SCOPE_STATUS_CONFLICT",
          detail: `Link ${i + 1}: epistemicStatus ASSERTED cannot live inside a ${scopeType} scope — an asserted claim is not a supposition.`,
          linkIndex: i,
        };
      }
      // A hard epistemic status must match its hard scope default.
      if (
        (explicit === "HYPOTHETICAL" || explicit === "COUNTERFACTUAL") &&
        (defaultStatus === "HYPOTHETICAL" || defaultStatus === "COUNTERFACTUAL") &&
        explicit !== defaultStatus
      ) {
        return {
          ok: false,
          code: "SCOPE_STATUS_CONFLICT",
          detail: `Link ${i + 1}: epistemicStatus ${explicit} conflicts with its ${scopeType} scope (default ${defaultStatus}).`,
          linkIndex: i,
        };
      }
    }

    const resolvedStatus = explicit ?? defaultStatus;

    // Mode coercion target (§4.4): scope-type driven, skipped for permissive
    // explicit statuses (CONDITIONAL/QUESTIONED/SUSPENDED leave mode as supplied).
    let coercedMode: EpistemicMode | null = null;
    if (scopeType) {
      const target = SCOPE_COERCED_MODE[scopeType];
      const permissive = explicit ? PERMISSIVE_STATUSES.has(explicit) : false;
      if (target && !permissive) coercedMode = target;
    }

    resolvedLinks.push({
      scopeIndex: si ?? null,
      epistemicStatus: resolvedStatus,
      dialecticalRole: link.dialecticalRole ?? null,
      coercedMode,
    });
  }

  // 4. Containment over support edges (§4.2). For a support edge a→b (b draws
  //    on a's conclusion), b's scope must be a's scope or a descendant of it.
  //    Reasoning *into* a deeper supposition is fine; a conclusion drawn inside
  //    scope S may not leak out as an asserted premise.
  const linkScope = resolvedLinks.map((l) => l.scopeIndex);
  const isDescendantOrEqual = (child: number | null, ancestor: number): boolean => {
    let cur = child;
    while (cur !== null) {
      if (cur === ancestor) return true;
      cur = parentIndex[cur];
    }
    return false;
  };
  for (const e of supportEdges) {
    const sa = linkScope[e.from];
    const sb = linkScope[e.to];
    if (sa === null) continue; // an asserted/shallower premise may feed any scope
    if (!isDescendantOrEqual(sb, sa)) {
      return {
        ok: false,
        code: "SCOPE_LEAK",
        detail: `Link ${e.to + 1} (scope ${sb ?? "actual world"}) threads link ${e.from + 1}'s conclusion drawn inside scope ${sa}; a conclusion drawn inside a supposition may not be used outside it.`,
        linkIndex: e.to,
      };
    }
  }

  // 5. Advisory: a declared scope with no links assigned.
  for (let i = 0; i < scopes.length; i++) {
    if (!usedScopes.has(i)) {
      warnings.push({
        code: "scope_empty",
        detail: `Scope ${i} (${scopes[i].scopeType}: "${scopes[i].assumption.slice(0, 40)}") has no links assigned.`,
      });
    }
  }

  const resolvedScopes: ResolvedScope[] = scopes.map((s, i) => ({
    index: i,
    scopeType: s.scopeType,
    assumption: s.assumption,
    description: s.description,
    parentIndex: parentIndex[i],
    depth: depth[i],
  }));

  return { ok: true, resolvedScopes, links: resolvedLinks, warnings };
}
