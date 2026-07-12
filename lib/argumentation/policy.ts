// lib/argumentation/policy.ts
//
// Phase 4b of the argumentation-semantics consolidation roadmap: the semantics
// policy. The choice of acceptance semantics — skeptical-grounded vs
// skeptical-preferred vs skeptical-stable — is a deliberation-level setting, not
// a per-request accident. The Q-031 closure makes this *mandatory*: an odd cycle
// has no grounded verdict (all UNDEC), so which semantics to surface must be an
// explicit, stored choice rather than a scattered query-param default.
//
// Resolution order (most specific wins):
//   1. an explicit per-request override (e.g. a query param),
//   2. the stored per-deliberation setting (`Deliberation.argumentSemantics`),
//   3. the engine default (`DEFAULT_SEMANTICS_POLICY`).

import type { ArgId, DefeatGraph, Labelling } from "@/lib/argumentation/types";
import { groundedLabelling, labellingOf } from "@/lib/argumentation/labelling";
import {
  preferredExtensions,
  stableExtensions,
} from "@/lib/argumentation/semantics";

export type SemanticsPolicy = "grounded" | "preferred" | "stable";

export const SEMANTICS_POLICIES: readonly SemanticsPolicy[] = [
  "grounded",
  "preferred",
  "stable",
] as const;

/** Engine default when neither a request override nor a stored setting applies. */
export const DEFAULT_SEMANTICS_POLICY: SemanticsPolicy = "preferred";

/** Type guard: is `x` a valid semantics policy name? */
export function isSemanticsPolicy(x: unknown): x is SemanticsPolicy {
  return typeof x === "string" && (SEMANTICS_POLICIES as readonly string[]).includes(x);
}

/**
 * Resolve the effective semantics policy. A per-request `override` (e.g. a
 * `?semantics=` query param) wins; otherwise the `stored` per-deliberation
 * setting; otherwise the engine default. Invalid values are ignored at each
 * level so a stray query param can never break acceptance computation.
 */
export function resolveSemanticsPolicy(opts: {
  override?: string | null;
  stored?: string | null;
}): SemanticsPolicy {
  if (isSemanticsPolicy(opts.override)) return opts.override;
  if (isSemanticsPolicy(opts.stored)) return opts.stored;
  return DEFAULT_SEMANTICS_POLICY;
}

/**
 * The skeptical labelling induced by a family of extensions: an argument is IN
 * iff it is in *every* extension; OUT iff attacked by the skeptically-accepted
 * set; UNDEC otherwise. An empty family (e.g. no stable extension exists) yields
 * an all-UNDEC labelling.
 */
function skepticalLabelling(dg: DefeatGraph, extensions: Set<ArgId>[]): Labelling {
  const skepticalIn = new Set<ArgId>();
  if (extensions.length > 0) {
    for (const a of extensions[0]) {
      if (extensions.every((E) => E.has(a))) skepticalIn.add(a);
    }
  }
  return labellingOf(dg, skepticalIn);
}

/**
 * Compute the acceptance labelling of a defeat graph under the given policy.
 * This is the single dispatch point that route handlers call instead of
 * branching on a semantics string and inlining the extension intersection.
 *
 *   • `grounded`  — the (unique) grounded labelling.
 *   • `preferred` — skeptical over the preferred extensions.
 *   • `stable`    — skeptical over the stable extensions (all-UNDEC if none).
 */
export function policyLabelling(dg: DefeatGraph, policy: SemanticsPolicy): Labelling {
  switch (policy) {
    case "grounded":
      return groundedLabelling(dg);
    case "preferred":
      return skepticalLabelling(dg, preferredExtensions(dg));
    case "stable":
      return skepticalLabelling(dg, stableExtensions(dg));
  }
}
