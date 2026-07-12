// lib/argumentation/composerEnthymemeCheck.ts
// Sprint D3 — thin adapter that runs `detectEnthymemes()` from
// `lib/argumentation/ecc.ts` against a freshly created argument and its
// scheme, returning a publish-time nudge list the composer can render
// inline. Kept in lib/ (no Prisma dependency) so the same function can be
// reused by other write paths and tested without a live DB.

import {
  detectEnthymemes,
  type Arrow,
  type AssumptionId,
  type DerivationId,
  type EnthymemeNudge,
  type SchemeCatalog,
  type SchemeSpec,
  type DerivationSchemeMeta,
} from "@/lib/argumentation/ecc";

export interface ComposerCheckInput {
  argumentId: string;
  schemeKey: string;
  /** `slotHints.premises` from the `ArgumentScheme` row. */
  requiredRoles: string[];
  /** Roles the author actually filled (typically `groupKey` on premises;
   *  also include `"warrant"` when an explicit warrant claim is present). */
  rolesPresent: string[];
}

/**
 * @invariant Empty `requiredRoles` ⇒ no nudges (a scheme with no role
 *   contract is a structural pass).
 * @invariant `requiredRoles ⊆ rolesPresent` ⇒ no nudges.
 * @invariant Pure: same input ⇒ same output.
 */
export function checkComposerEnthymemes(input: ComposerCheckInput): EnthymemeNudge[] {
  if (!input.schemeKey || input.requiredRoles.length === 0) return [];

  // Build a minimal single-derivation Arrow. The algebra only inspects
  // `arrow.derivs` and the per-derivation meta accessor.
  const derivId = input.argumentId as DerivationId;
  const arrow: Arrow = {
    from: "premises",
    to: input.argumentId,
    derivs: new Set<DerivationId>([derivId]),
    assumptions: new Map<DerivationId, Set<AssumptionId>>([[derivId, new Set()]]),
  };
  const catalog: SchemeCatalog = {
    get(key) {
      if (key !== input.schemeKey) return undefined;
      const spec: SchemeSpec = { key, requiredRoles: input.requiredRoles };
      return spec;
    },
  };
  const metaFor = (d: DerivationId): DerivationSchemeMeta | undefined =>
    d === derivId
      ? {
          schemeKey: input.schemeKey,
          argumentId: input.argumentId,
          rolesPresent: input.rolesPresent,
        }
      : undefined;

  return detectEnthymemes(arrow, catalog, metaFor);
}
