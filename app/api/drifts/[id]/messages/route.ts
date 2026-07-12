export const runtime = "nodejs";
export const revalidate = 0;                  // Next.js: no ISR
export const dynamic = "force-dynamic";   

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { toAclFacet, userCtxFrom } from "@/app/api/sheaf/_map";
import { visibleFacetsFor, defaultFacetFor } from "@app/sheaf-acl";
import { facetToPlainText } from "@/lib/text/mentions";
import { extractUrls } from "@/lib/text/urls";
import { hashUrl } from "@/lib/unfurl";
import { resolveQuoteForViewer, QuoteSpec } from "@/lib/sheaf/resolveQuote";
import { sendMessage } from "@/lib/actions/message.actions"; // for POST only
import { getUserFromCookies } from "@/lib/serverutils";      // for POST only

function toMs(v?: number | string | Date | null): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const t = new Date(v as any).getTime();
  return Number.isFinite(t) ? t : 0;
}
const s = (b: bigint) => b.toString();

//
// GET /api/drifts/:id/messages?userId=...&limit=...&cursor=...
// - cursor is an optional message id; we return items strictly AFTER it.
// - ordered ASC by createdAt.
//
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdStr = searchParams.get("userId");
    if (!userIdStr) return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });

    const driftId = BigInt(params.id);
    const viewerId = BigInt(userIdStr);

    // Resolve drift → conversation and ACL-check membership
    const drift = await prisma.drift.findUnique({
      where: { id: driftId },
      select: { id: true, conversation_id: true },
    });
    if (!drift) return NextResponse.json({ ok: false, error: "Unknown drift" }, { status: 404 });

    const isMember = await prisma.conversationParticipant.findFirst({
      where: { conversation_id: drift.conversation_id, user_id: viewerId },
      select: { user_id: true },
    });
    if (!isMember) return new NextResponse("Forbidden", { status: 403 });

    // Pagination
    const rawLimit = parseInt(searchParams.get("limit") ?? "100", 10);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 200)) : 100;
    const cursorIdStr = searchParams.get("cursor"); // fetch strictly AFTER this id
    const whereMsg: any = { drift_id: driftId };
    if (cursorIdStr) {
      whereMsg.id = { gt: BigInt(cursorIdStr) };
    }
// read params
const order = (searchParams.get("order") || "asc").toLowerCase();
const limitParam = searchParams.get("limit");
const summaryLimit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 1, 1), 200) : undefined;


    // Base rows
    const messages = await prisma.message.findMany({
      where: whereMsg,
      orderBy: { created_at: "asc" },
      take: limit,
      select: {
        id: true,
        sender_id: true,
        created_at: true,
        text: true,
        drift_id: true,
        meta: true,
        is_redacted: true,
        edited_at: true,
        sender: { select: { name: true, image: true } },
        attachments: { select: { id: true, path: true, type: true, size: true } },
      },
    });

    const messageIds = messages.map((m) => m.id);
    if (messageIds.length === 0) {
      return NextResponse.json({
        ok: true,
        conversationId: s(drift.conversation_id),
        driftId: s(driftId),
        messages: [],
        nextCursor: null,
      });
    }

    // Facets for these messages
    const facets = await prisma.sheafFacet.findMany({
      where: { messageId: { in: messageIds } },
    });

    // Preload lists for ACL
    const listIds = Array.from(
      new Set(facets.map((f) => f.audienceListId).filter((x): x is string => !!x))
    );
    const lists = new Map(
      (
        await prisma.sheafAudienceList.findMany({
          where: { id: { in: listIds } },
        })
      ).map((l) => [l.id, l])
    );

    // Facet attachments
    const facetIds = facets.map((f) => f.id);
    const atts = await prisma.sheafAttachment.findMany({
      where: { facetId: { in: facetIds } },
      include: { blob: true },
    });
    const attByFacet = new Map<string, { id: string; name: string; mime: string; size: number; sha256: string; path?: string | null }[]>();
    for (const a of atts) {
      const key = a.facetId.toString();
      const list = attByFacet.get(key) ?? [];
      list.push({
        id: a.id.toString(),
        name: a.name,
        mime: a.blob.mime,
        size: a.blob.size,
        sha256: a.blob.sha256,
        path: a.blob.path ?? null,
      });
      attByFacet.set(key, list);
    }

    // Group facets by message
    const byMessage = new Map<string, typeof facets>();
    for (const f of facets) {
      const key = f.messageId.toString();
      if (!byMessage.has(key)) byMessage.set(key, []);
      byMessage.get(key)!.push(f);
    }

    // Viewer context (roles + lists)
    const viewer = await prisma.user.findUnique({ where: { id: viewerId } });
    const viewerRoles = await prisma.userRole.findMany({ where: { userId: viewerId } });
    const rolesArr = viewerRoles.map((r) => r.role);
    const ctx = userCtxFrom(viewer!, rolesArr, lists);

    // ---------- Quotes preload ----------
    const quotesByMsg = new Map<string, QuoteSpec[]>();
    const allSourceIds = new Set<bigint>();
    for (const m of messages) {
      const meta = (m.meta ?? {}) as any;
      const arr = Array.isArray(meta?.quotes) ? meta.quotes : [];
      const list: QuoteSpec[] = [];
      for (const q of arr) {
        try {
          const sid = BigInt(String(q.sourceMessageId));
          const sfid = q.sourceFacetId ? BigInt(String(q.sourceFacetId)) : null;
          if (sid) {
            list.push({ sourceMessageId: sid, sourceFacetId: sfid ?? null });
            allSourceIds.add(sid);
          }
        } catch {}
      }
      if (list.length) quotesByMsg.set(m.id.toString(), list);
    }

    const srcMsgs = allSourceIds.size
      ? await prisma.message.findMany({
          where: { id: { in: Array.from(allSourceIds) } },
          select: {
            id: true,
            text: true,
            is_redacted: true,
            edited_at: true,
            sender: { select: { name: true, image: true } },
            attachments: { select: { id: true, path: true, type: true, size: true } },
          },
        })
      : [];
    const srcMsgById = new Map<string, (typeof srcMsgs)[number]>();
    for (const sm of srcMsgs) srcMsgById.set(sm.id.toString(), sm);

    const srcFacets = allSourceIds.size
      ? await prisma.sheafFacet.findMany({ where: { messageId: { in: Array.from(allSourceIds) } } })
      : [];
    const srcFacetById = new Map<string, (typeof srcFacets)[number]>();
    for (const f of srcFacets) srcFacetById.set(f.id.toString(), f);

    const srcFacetIds = srcFacets.map((f) => f.id);
    const srcAtts = srcFacetIds.length
      ? await prisma.sheafAttachment.findMany({
          where: { facetId: { in: srcFacetIds } },
          include: { blob: true },
        })
      : [];
    const srcAttByFacet = new Map<string, any[]>();
    for (const a of srcAtts) {
      const key = a.facetId.toString();
      const list = srcAttByFacet.get(key) ?? [];
      list.push({
        id: a.id.toString(),
        name: a.name,
        mime: a.blob.mime,
        size: a.blob.size,
        sha256: a.blob.sha256,
        path: a.blob.path ?? null,
      });
      srcAttByFacet.set(key, list);
    }

    const resolvedQuotesByMsg = new Map<string, any[]>();
    for (const m of messages) {
      const specs = quotesByMsg.get(m.id.toString()) ?? [];
      if (!specs.length) continue;
      const resolved = await Promise.all(
        specs.map((q) =>
          resolveQuoteForViewer(q, {
            srcMsgById,
            srcFacetById,
            srcAttByFacet,
            requireSourceVisibility: false,
          })
        )
      );
      resolvedQuotesByMsg.set(m.id.toString(), resolved);
    }

    // ---------- Link preview hydration (plain + facets) ----------
    const plainHashesByMsg = new Map<string, string[]>();
    const facetHashesByFacetId = new Map<string, string[]>();
    const allHashes = new Set<string>();

    for (const m of messages) {
      if (m.is_redacted) continue;
      const hashes = extractUrls(m.text ?? "").map(hashUrl);
      if (hashes.length) {
        plainHashesByMsg.set(m.id.toString(), hashes);
        hashes.forEach((h) => allHashes.add(h));
      }
    }

    for (const f of facets) {
      const text = facetToPlainText((f as any).body);
      const hashes = extractUrls(text).map(hashUrl);
      if (hashes.length) {
        facetHashesByFacetId.set(f.id.toString(), hashes);
        hashes.forEach((h) => allHashes.add(h));
      }
    }

    const previewRows = allHashes.size
      ? await prisma.linkPreview.findMany({
          where: { urlHash: { in: Array.from(allHashes) } },
        })
      : [];
    const previewByHash = new Map(previewRows.map((lp) => [lp.urlHash, lp]));

    // Mentions (for this viewer)
    const mentionRows = await prisma.messageMention.findMany({
      where: { messageId: { in: messageIds }, userId: viewerId },
      select: { messageId: true },
    });
    const mentionedMsgIds = new Set(mentionRows.map((r) => r.messageId.toString()));

    // ---------- Build DTOs ----------
    const results = messages
      .map((m) => {
        if (m.is_redacted) {
          return {
            id: s(m.id),
            senderId: s(m.sender_id),
            sender: { name: m.sender?.name ?? null, image: m.sender?.image ?? null },
            createdAt: m.created_at.toISOString(),
            driftId: m.drift_id ? s(m.drift_id) : null,
            meta: (m.meta as any) ?? null,
            isRedacted: true,
            facets: [],
            defaultFacetId: null,
            text: null,
            attachments: [],
          };
        }

        const raw = byMessage.get(m.id.toString()) ?? [];
        const quotes = resolvedQuotesByMsg.get(m.id.toString()) ?? [];

        // Plain
        if (raw.length === 0) {
          const edited = !!m.edited_at;
          const hashes = plainHashesByMsg.get(m.id.toString()) ?? [];
          const linkPreviews = hashes
            .map((h) => previewByHash.get(h))
            .filter(Boolean)
            .map((lp: any) => ({
              urlHash: lp.urlHash,
              url: lp.url,
              title: lp.title,
              desc: lp.desc,
              image: lp.image,
              status: lp.status,
            }));

          const mentionsMe = mentionedMsgIds.has(m.id.toString());

          return {
            id: s(m.id),
            senderId: s(m.sender_id),
            sender: { name: m.sender?.name ?? null, image: m.sender?.image ?? null },
            createdAt: m.created_at.toISOString(),
            driftId: m.drift_id ? s(m.drift_id) : null,
            meta: (m.meta as any) ?? null,
            facets: [],
            defaultFacetId: null,
            text: m.text ?? null,
            attachments: m.attachments.map((a) => ({
              id: a.id.toString(),
              path: a.path,
              type: a.type,
              size: a.size,
            })),
            isRedacted: false,
            edited,
            quotes,
            linkPreviews,
            mentionsMe,
          };
        }

        // Sheaf (visible facets only)
        const fs = raw.map(toAclFacet).map((af) => ({ ...af, attachments: attByFacet.get(af.id) ?? [] }));
        const visible = visibleFacetsFor(ctx, fs as any);

        if (visible.length === 0) {
          if (m.text || m.attachments.length) {
            const edited = !!m.edited_at;
            return {
              id: s(m.id),
              senderId: s(m.sender_id),
              sender: { name: m.sender?.name ?? null, image: m.sender?.image ?? null },
              createdAt: m.created_at.toISOString(),
              driftId: m.drift_id ? s(m.drift_id) : null,
              meta: (m.meta as any) ?? null,
              isRedacted: false,
              facets: [],
              defaultFacetId: null,
              text: m.text ?? null,
              attachments: m.attachments.map((a) => ({
                id: a.id.toString(),
                path: a.path,
                type: a.type,
                size: a.size,
              })),
              edited,
              quotes,
            };
          }
          return null;
        }

        const def = defaultFacetFor(ctx, fs as any);
        const defId = def?.id ?? visible[0].id;
        const defObj = visible.find((f: any) => f.id === defId) ?? visible[0];
        const edited = toMs(defObj?.updatedAt) > toMs(defObj?.createdAt);
        const mentionsMe = mentionedMsgIds.has(m.id.toString());

        return {
          id: s(m.id),
          senderId: s(m.sender_id),
          sender: { name: m.sender?.name ?? null, image: m.sender?.image ?? null },
          createdAt: m.created_at.toISOString(),
          driftId: m.drift_id ? s(m.drift_id) : null,
          meta: (m.meta as any) ?? null,
          facets: visible.map((f: any) => {
            const fHashes = facetHashesByFacetId.get(f.id) ?? [];
            const fPreviews = fHashes
              .map((h) => previewByHash.get(h))
              .filter(Boolean)
              .map((lp: any) => ({
                urlHash: lp.urlHash,
                url: lp.url,
                title: lp.title,
                desc: lp.desc,
                image: lp.image,
                status: lp.status,
              }));
            return {
              id: f.id,
              audience: f.audience,
              sharePolicy: f.sharePolicy,
              expiresAt: f.expiresAt ?? null,
              body: f.body,
              attachments: f.attachments ?? [],
              priorityRank: f.priorityRank,
              createdAt: f.createdAt,
              updatedAt: f.updatedAt ?? null,
              isEdited: toMs(f.updatedAt) > toMs(f.createdAt),
              linkPreviews: fPreviews,
            };
          }),
          defaultFacetId: defId,
          text: m.text ?? null,
          attachments: m.attachments.map((a) => ({
            id: a.id.toString(),
            path: a.path,
            type: a.type,
            size: a.size,
          })),
          isRedacted: false,
          edited,
          quotes,
          mentionsMe,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const nextCursor =
      results.length > 0 ? results[results.length - 1].id : null;
      return NextResponse.json(
        {
          ok: true,
          conversationId: s(drift.conversation_id),
          driftId: s(driftId),
          messages: results,
          nextCursor,
        },
        {
          headers: {
            // belt & suspenders for any aggressive caches
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
      
  } catch (e: any) {
    console.error("[GET /api/drifts/:id/messages] error", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Internal error" }, { status: 500 });
  }
}

//
// OPTIONAL: POST /api/drifts/:id/messages
// Accepts multipart/form-data like your /api/messages/:conversationId endpoint:
//  - text (string?)
//  - files (File[]) optional
//  - clientId (string) optional idempotency key
//  - meta (stringified JSON) optional (e.g., quotes)
//
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getUserFromCookies();
    if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });

    const driftId = BigInt(params.id);
    const drift = await prisma.drift.findUnique({
      where: { id: driftId },
      select: { id: true, conversation_id: true },
    });
    if (!drift) return NextResponse.json({ ok: false, error: "Unknown drift" }, { status: 404 });

    // Ensure participant
    const isMember = await prisma.conversationParticipant.findFirst({
      where: { conversation_id: drift.conversation_id, user_id: me.userId },
      select: { user_id: true },
    });
    if (!isMember) return new NextResponse("Forbidden", { status: 403 });

    const form = await req.formData();
    const text = (form.get("text") as string | null) ?? null;
    const files = form.getAll("files").filter(Boolean) as File[];
    const clientId = (form.get("clientId") as string | null) ?? undefined;

    let meta: any | undefined = undefined;
    const metaRaw = form.get("meta");
    if (typeof metaRaw === "string" && metaRaw.trim()) {
      try { meta = JSON.parse(metaRaw); } catch {}
    }

    const saved = await sendMessage({
      conversationId: drift.conversation_id,
      senderId: me.userId,
      text: text ?? undefined,
      files: files.length ? files : undefined,
      driftId,
      clientId,
      meta,
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    console.error("[POST /api/drifts/:id/messages] error", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
