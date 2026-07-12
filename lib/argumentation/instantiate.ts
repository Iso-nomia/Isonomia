// lib/argumentation/instantiate.ts
//
// Phase 2 of the argumentation-semantics consolidation roadmap: the ASPIC+
// instantiation contract. Converts a *structured* ASPIC+ layer (arguments +
// preference-resolved defeats) into the representation-neutral `DefeatGraph`
// consumed by the abstract Dung core (`labelling.ts` / `semantics.ts`).
//
// This is what makes the structured and abstract layers share ONE defeat graph:
// once instantiated, ASPIC+ theories get grounded / preferred / stable /
// semi-stable from the same exact engine as everything else, so preferences
// (which today only ever reach grounded via `lib/aspic/`) influence every
// semantics.
//
// An ASPIC+ "defeat" (a preference-surviving attack) becomes a Dung attack
// defeater → defeated. Undercutting/undermining/rebutting distinctions and
// preference resolution are already collapsed into the `Defeat[]` relation by
// `lib/aspic/defeats.ts`; the Dung layer only needs the surviving conflicts.

import type { ArgId, DefeatGraph } from "@/lib/argumentation/types";

/**
 * Minimal shape of an ASPIC+ argument needed for instantiation. Structurally
 * compatible with `lib/aspic/types.ts`'s `Argument` (we only read `id`), so we
 * avoid a hard import dependency on the structured layer.
 */
export interface InstantiableArgument {
  id: ArgId;
}

/**
 * Minimal shape of an ASPIC+ defeat needed for instantiation. Structurally
 * compatible with `lib/aspic/types.ts`'s `Defeat`.
 */
export interface InstantiableDefeat {
  defeater: { id: ArgId };
  defeated: { id: ArgId };
}

/**
 * Instantiate a Dung `DefeatGraph` from an ASPIC+ argument set and its
 * preference-resolved defeat relation.
 *
 * @param args    all ASPIC+ arguments (each contributes one node)
 * @param defeats surviving defeats (each contributes one attack edge)
 */
export function instantiateDefeatGraph(
  args: InstantiableArgument[],
  defeats: InstantiableDefeat[]
): DefeatGraph {
  const attacks = new Map<ArgId, Set<ArgId>>();
  const ids: ArgId[] = [];
  for (const a of args) {
    if (!attacks.has(a.id)) {
      attacks.set(a.id, new Set());
      ids.push(a.id);
    }
  }

  for (const d of defeats) {
    const from = d.defeater.id;
    const to = d.defeated.id;
    // Only wire defeats between known arguments; ignore dangling references.
    if (!attacks.has(from) || !attacks.has(to)) continue;
    attacks.get(from)!.add(to);
  }

  return { args: ids, attacks };
}
