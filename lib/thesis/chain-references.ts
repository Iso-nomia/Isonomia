// lib/thesis/chain-references.ts
//
// D4 Week 1–2 — maintain `ThesisChainReference` rows by walking thesis content.
//
// Called from the thesis save endpoint (PATCH) whenever `content` is present.
// Reconciles the explicit reference table with the `argumentChainNode` atoms
// embedded in the TipTap document so backlinks and the live/inspect/attack
// pipelines have a stable index without re-walking JSON on every read.

import type { JSONContent } from "@tiptap/core";
import { prisma } from "@/lib/prismaclient";

type ChainReferenceRole =
  | "MAIN"
  | "SUPPORTING"
  | "OBJECTION_TARGET"
  | "COMPARISON";

interface WalkedChainRef {
  chainId: string;
  role: ChainReferenceRole;
  caption: string | null;
}

const VALID_ROLES = new Set<ChainReferenceRole>([
  "MAIN",
  "SUPPORTING",
  "OBJECTION_TARGET",
  "COMPARISON",
]);

function visit(node: JSONContent | undefined | null, out: Map<string, WalkedChainRef>) {
  if (!node || typeof node !== "object") return;
  if (node.type === "argumentChainNode") {
    const attrs = (node.attrs ?? {}) as Record<string, unknown>;
    const chainId =
      typeof attrs.chainId === "string" && attrs.chainId.length > 0
        ? attrs.chainId
        : null;
    if (chainId) {
      const rawRole = typeof attrs.role === "string" ? attrs.role : "MAIN";
      const role: ChainReferenceRole = VALID_ROLES.has(
        rawRole as ChainReferenceRole,
      )
        ? (rawRole as ChainReferenceRole)
        : "MAIN";
      const caption =
        typeof attrs.caption === "string" && attrs.caption.length > 0
          ? attrs.caption
          : null;
      // First occurrence wins; later edits with same chainId reuse the row.
      if (!out.has(chainId)) {
        out.set(chainId, { chainId, role, caption });
      }
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) visit(child, out);
  }
}

/**
 * Reconcile `ThesisChainReference` rows for a thesis with the chains embedded
 * in its TipTap content. Idempotent.
 *
 *   • Inserts rows for chain ids that appear in content but are not yet
 *     referenced.
 *   • Updates `role` / `caption` when the in-content attrs have changed.
 *   • Deletes rows whose chain id is no longer present in content.
 *
 * Returns the resulting set of (chainId, role) for callers that want to log it.
 */
export async function syncThesisChainReferences(
  thesisId: string,
  content: JSONContent | null | undefined,
): Promise<Array<{ chainId: string; role: ChainReferenceRole }>> {
  const walked = new Map<string, WalkedChainRef>();
  if (content) visit(content, walked);

  const desiredIds = Array.from(walked.keys());

  const existing = await prisma.thesisChainReference.findMany({
    where: { thesisId },
    select: { id: true, chainId: true, role: true, caption: true },
  });
  const existingById = new Map(existing.map((r) => [r.chainId, r]));

  const toCreate: WalkedChainRef[] = [];
  const toUpdate: Array<{
    id: string;
    role: ChainReferenceRole;
    caption: string | null;
  }> = [];
  const desiredSet = new Set(desiredIds);

  for (const ref of walked.values()) {
    const prev = existingById.get(ref.chainId);
    if (!prev) {
      toCreate.push(ref);
    } else if (prev.role !== ref.role || (prev.caption ?? null) !== ref.caption) {
      toUpdate.push({ id: prev.id, role: ref.role, caption: ref.caption });
    }
  }

  const toDeleteIds = existing
    .filter((r) => !desiredSet.has(r.chainId))
    .map((r) => r.id);

  // Issue writes in parallel; failures here should not break thesis save, but
  // we surface them via thrown errors so the caller can log.
  await Promise.all([
    toCreate.length > 0
      ? prisma.thesisChainReference.createMany({
          data: toCreate.map((r) => ({
            thesisId,
            chainId: r.chainId,
            role: r.role,
            caption: r.caption,
          })),
          skipDuplicates: true,
        })
      : Promise.resolve(),
    ...toUpdate.map((u) =>
      prisma.thesisChainReference.update({
        where: { id: u.id },
        data: { role: u.role, caption: u.caption },
      }),
    ),
    toDeleteIds.length > 0
      ? prisma.thesisChainReference.deleteMany({
          where: { id: { in: toDeleteIds } },
        })
      : Promise.resolve(),
  ]);

  return Array.from(walked.values()).map((r) => ({
    chainId: r.chainId,
    role: r.role,
  }));
}
