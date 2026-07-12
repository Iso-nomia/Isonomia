import type { Prisma } from "@prisma/client";
import type { ArgumentChainWithRelations } from "@/lib/types/argumentChain";
import { CHAIN_PAGE_INCLUDE } from "./chainInclude";

/** Hydrated chain exactly as returned by a Prisma read with `CHAIN_PAGE_INCLUDE`. */
export type HydratedChain = Prisma.ArgumentChainGetPayload<{
  include: typeof CHAIN_PAGE_INCLUDE;
}>;

/** Coerce a `bigint` (or already-stringified value) to a string. No-op-safe. */
function toStr(value: bigint | string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "bigint" ? value.toString() : String(value);
}

/**
 * Serialize every `BigInt` field on a hydrated chain (`createdBy`,
 * `creator.id`, node `addedBy`/`contributor.id`/`argument.authorId`,
 * edge node `addedBy`, scope `createdBy`) into a string so the payload
 * is JSON-safe and can be handed to client view components.
 *
 * Idempotent: safe to call on input whose BigInts are already strings.
 */
export function serializeChain(
  chain: HydratedChain,
): ArgumentChainWithRelations {
  const serialized = {
    ...chain,
    createdBy: toStr(chain.createdBy),
    creator: chain.creator
      ? {
          ...chain.creator,
          id: toStr(chain.creator.id),
        }
      : chain.creator,
    nodes: chain.nodes.map((node) => ({
      ...node,
      addedBy: toStr(node.addedBy),
      contributor: node.contributor
        ? {
            ...node.contributor,
            id: toStr(node.contributor.id),
          }
        : node.contributor,
      argument: node.argument
        ? {
            ...node.argument,
            authorId: toStr(node.argument.authorId),
          }
        : null,
    })),
    edges: chain.edges.map((edge) => ({
      ...edge,
      sourceNode: edge.sourceNode
        ? {
            ...edge.sourceNode,
            addedBy: toStr(edge.sourceNode.addedBy),
          }
        : null,
      targetNode: edge.targetNode
        ? {
            ...edge.targetNode,
            addedBy: toStr(edge.targetNode.addedBy),
          }
        : null,
    })),
    scopes:
      chain.scopes?.map((scope) => ({
        ...scope,
        createdBy: toStr(scope.createdBy),
      })) ?? [],
  };

  // The view components consume `ArgumentChainWithRelations`; the serialized
  // shape is structurally compatible (BigInts widened to strings).
  return serialized as unknown as ArgumentChainWithRelations;
}
