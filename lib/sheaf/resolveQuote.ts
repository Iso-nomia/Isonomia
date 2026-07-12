// lib/sheaf/resolveQuote.ts
import { toAclFacet } from '@/app/api/sheaf/_map'; // or your actual import

// Minimal shapes to avoid Prisma types here
export type QuoteSpec = { sourceMessageId: bigint; sourceFacetId?: bigint | null };
export type QuoteDTO =
  | { sourceMessageId: string; sourceFacetId?: string; status: "redacted" | "unavailable" }
  | {
      sourceMessageId: string;
      sourceFacetId?: string;
      status: "ok";
      body: unknown | null;
      attachments: Array<{ id: string; name?: string; mime: string; size: number; sha256?: string; path?: string | null }>;
      isEdited: boolean;
      sourceAuthor?: { name: string | null; image: string | null } | null;
      updatedAt?: string | null;
    };

function toMs(v?: number | string | Date | null): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const t = new Date(v as any).getTime();
  return Number.isFinite(t) ? t : 0;
}

type ResolveDeps = {
  // lookups preloaded by your route:
  srcMsgById: Map<string, { id: bigint; text: string | null; is_redacted: boolean; edited_at: Date | null; sender?: { name: string | null; image: string | null } | null; attachments: { id: bigint; path: string; type: string; size: number }[] }>;
  srcFacetById: Map<string, any>; // raw facet rows -> will pass through toAclFacet
  srcAttByFacet: Map<string, any[]>;
  // ACL visibility (optional):
  requireSourceVisibility?: boolean; // default false: ALLOW lets you re-share
  // If true, provide a function that returns whether viewer can see this facet now:
  canViewerSeeFacetNow?: (rawFacet: any) => boolean | Promise<boolean>;
};

export async function resolveQuoteForViewer(q: QuoteSpec, deps: ResolveDeps): Promise<QuoteDTO> {
  const { srcMsgById, srcFacetById, srcAttByFacet, requireSourceVisibility = false, canViewerSeeFacetNow } = deps;

  const sm = srcMsgById.get(q.sourceMessageId.toString());
  if (!sm) return { sourceMessageId: q.sourceMessageId.toString(), status: "unavailable" };
  if (sm.is_redacted) return { sourceMessageId: q.sourceMessageId.toString(), status: "redacted" };

  // Quoting a specific facet
  if (q.sourceFacetId) {
    const raw = srcFacetById.get(q.sourceFacetId.toString());
    if (!raw)
      return { sourceMessageId: q.sourceMessageId.toString(), sourceFacetId: q.sourceFacetId.toString(), status: "unavailable" };

    if (requireSourceVisibility && canViewerSeeFacetNow) {
      const ok = await canViewerSeeFacetNow(raw);
      if (!ok) return { sourceMessageId: q.sourceMessageId.toString(), sourceFacetId: q.sourceFacetId.toString(), status: "unavailable" };
    }

    const af = toAclFacet(raw); // { sharePolicy, body, createdAt, updatedAt, id, ... }
    if (af.sharePolicy === "FORBID")
      return { sourceMessageId: q.sourceMessageId.toString(), sourceFacetId: q.sourceFacetId.toString(), status: "unavailable" };
    if (af.sharePolicy === "REDACT")
      return { sourceMessageId: q.sourceMessageId.toString(), sourceFacetId: q.sourceFacetId.toString(), status: "redacted" };

    // ALLOW
    const isEdited = toMs(af.updatedAt) > toMs(af.createdAt);
    return {
      sourceMessageId: q.sourceMessageId.toString(),
      sourceFacetId: q.sourceFacetId.toString(),
      status: "ok",
      body: af.body ?? null,
      attachments: srcAttByFacet.get(af.id) ?? [],
      isEdited,
      sourceAuthor: { name: sm.sender?.name ?? null, image: sm.sender?.image ?? null },
      updatedAt: af.updatedAt != null ? String(af.updatedAt) : null,
    };
  }

  // Quote the plain message
  const isEdited = !!sm.edited_at;
  return {
    sourceMessageId: q.sourceMessageId.toString(),
    status: "ok",
    body: sm.text ?? null,
    attachments: sm.attachments.map((a) => ({
      id: a.id.toString(),
      name: a.path.split("/").pop() ?? a.path,
      mime: a.type,
      size: a.size,
      sha256: "",
      path: a.path,
    })),
    isEdited,
    sourceAuthor: { name: sm.sender?.name ?? null, image: sm.sender?.image ?? null },
    updatedAt: sm.edited_at ? sm.edited_at.toISOString() : null,
  };
}
