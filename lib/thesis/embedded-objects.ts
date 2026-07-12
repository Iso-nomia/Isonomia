/**
 * Walk a thesis TipTap document and collect the ids of all embedded
 * deliberation objects (claims, arguments, propositions, citations).
 *
 * Used by the Living Thesis "/live" endpoint (Phase 1.1) to know which
 * objects need a fresh stats lookup, and by future phases (inspector,
 * attack register, confidence audit) for the same purpose.
 *
 * Node names match the TipTap extensions in `lib/tiptap/extensions/`:
 *   - claimNode       → attrs.claimId
 *   - argumentNode    → attrs.argumentId
 *   - propositionNode → attrs.propositionId
 *   - citationNode    → attrs.citationId
 *   - argumentChainNode → attrs.chainId   (D4 Week 1–2)
 *
 * Draft variants (`draftClaim`, `draftArgument`, `draftProposition`) are
 * intentionally ignored — they have no real object to look up yet.
 */

import type { JSONContent } from "@tiptap/core";

export type EmbeddedKind = "claim" | "argument" | "proposition" | "citation" | "chain";

export interface EmbeddedRef {
  kind: EmbeddedKind;
  id: string;
}

export interface EmbeddedInventory {
  claimIds: string[];
  argumentIds: string[];
  propositionIds: string[];
  citationIds: string[];
  chainIds: string[];
  /** Flat list preserving (kind, id) pairs in document order, deduped. */
  all: EmbeddedRef[];
}

const NODE_TO_KIND: Record<string, { kind: EmbeddedKind; attr: string }> = {
  claimNode: { kind: "claim", attr: "claimId" },
  argumentNode: { kind: "argument", attr: "argumentId" },
  propositionNode: { kind: "proposition", attr: "propositionId" },
  citationNode: { kind: "citation", attr: "citationId" },
  argumentChainNode: { kind: "chain", attr: "chainId" },
};

function visit(
  node: JSONContent | undefined | null,
  out: EmbeddedRef[],
  seen: Set<string>,
): void {
  if (!node || typeof node !== "object") return;

  if (node.type && NODE_TO_KIND[node.type]) {
    const { kind, attr } = NODE_TO_KIND[node.type];
    const id = node.attrs?.[attr];
    if (typeof id === "string" && id.length > 0) {
      const key = `${kind}:${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ kind, id });
      }
    }
  }

  const children = node.content;
  if (Array.isArray(children)) {
    for (const child of children) visit(child, out, seen);
  }
}

/**
 * Walk a TipTap JSONContent tree and return all embedded object refs,
 * grouped by kind and as a flat ordered list.
 *
 * Safe to call with `null` / `undefined` content (returns empty inventory).
 */
export function collectEmbeddedObjects(
  content: JSONContent | null | undefined,
): EmbeddedInventory {
  const all: EmbeddedRef[] = [];
  const seen = new Set<string>();

  if (content) visit(content, all, seen);

  return {
    claimIds: all.filter((r) => r.kind === "claim").map((r) => r.id),
    argumentIds: all.filter((r) => r.kind === "argument").map((r) => r.id),
    propositionIds: all.filter((r) => r.kind === "proposition").map((r) => r.id),
    citationIds: all.filter((r) => r.kind === "citation").map((r) => r.id),
    chainIds: all.filter((r) => r.kind === "chain").map((r) => r.id),
    all,
  };
}

/**
 * Merge an inventory walked from TipTap content with structured-prong
 * references on the thesis (prong main claims, prong arguments, optional
 * top-level thesis claim). Results are deduped per (kind, id).
 */
export function mergeStructuredRefs(
  inventory: EmbeddedInventory,
  extra: {
    thesisClaimId?: string | null;
    prongMainClaimIds?: Array<string | null | undefined>;
    prongArgumentIds?: Array<string | null | undefined>;
  },
): EmbeddedInventory {
  const seen = new Set<string>(inventory.all.map((r) => `${r.kind}:${r.id}`));
  const all: EmbeddedRef[] = [...inventory.all];

  const push = (kind: EmbeddedKind, id: string | null | undefined) => {
    if (!id) return;
    const key = `${kind}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    all.push({ kind, id });
  };

  push("claim", extra.thesisClaimId);
  for (const id of extra.prongMainClaimIds ?? []) push("claim", id);
  for (const id of extra.prongArgumentIds ?? []) push("argument", id);

  return {
    claimIds: all.filter((r) => r.kind === "claim").map((r) => r.id),
    argumentIds: all.filter((r) => r.kind === "argument").map((r) => r.id),
    propositionIds: all.filter((r) => r.kind === "proposition").map((r) => r.id),
    citationIds: all.filter((r) => r.kind === "citation").map((r) => r.id),
    chainIds: all.filter((r) => r.kind === "chain").map((r) => r.id),
    all,
  };
}
