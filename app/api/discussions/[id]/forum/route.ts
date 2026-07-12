// app/api/discussions/[id]/forum/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { facetToPlainText } from "@/lib/text/mentions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Helpers
function toPlainText(x: any): string {
  try {
    if (typeof x === "string") return x;
    return facetToPlainText(x);
  } catch {
    return typeof x === "string" ? x : "";
  }
}

function S(x: any): string | null {
  if (x == null) return null;
  return String(x);
}

function serializeComment(row: any) {
  return {
    id: S(row.id)!,
    discussionId: row.discussionId,
    parentId: row.parentId != null ? S(row.parentId) : null,
    authorId: row.authorId,
    body: row.body,
    bodyText: row.bodyText, // already plain here
    sourceMessageId: row.sourceMessageId ?? null,
    score: row.score ?? 0,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    // Optional children (when includeReplies=1 or parentId is used)
    _children: Array.isArray(row._children) ? row._children : undefined,
  };
}

// ---------- GET
// Query:
//   limit (default 30), cursor (BigInt id), sort (ignored server-side for now),
//   includeReplies: "1" (direct) | "all" (deep),
//   parentId: if set -> returns replies under that parent. combine with includeReplies=all for full subtree.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10), 100);
    const cursor = url.searchParams.get("cursor");
    const include = (url.searchParams.get("includeReplies") || "").toLowerCase();
    const deep = include === "all";
    const direct = include === "1" || include === "true";
    const parentIdParam = url.searchParams.get("parentId");
  
    // --- Case A: replies of a given parent
    if (parentIdParam) {
      const parentId = BigInt(parentIdParam);
  
      if (!deep) {
        // direct children only
        const kids = await prisma.forumComment.findMany({
          where: { discussionId: params.id, parentId },
          orderBy: { id: "asc" },
          select: {
            id: true, authorId: true, body: true, bodyText: true,
            createdAt: true, score: true, sourceMessageId: true,
            parentId: true, discussionId: true,
          },
        });
        return NextResponse.json({ items: kids.map(serializeComment) });
      }
  
      // deep subtree under this parent (recursive CTE)
      const rows: any[] = await prisma.$queryRawUnsafe(
        `
        WITH RECURSIVE "subtree" AS (
          SELECT "id","discussionId","parentId","authorId","body","bodyText","createdAt","score","sourceMessageId"
          FROM "ForumComment"
          WHERE "discussionId" = $1 AND "id" = $2
          UNION ALL
          SELECT c."id", c."discussionId", c."parentId", c."authorId", c."body", c."bodyText", c."createdAt", c."score", c."sourceMessageId"
          FROM "ForumComment" c
          JOIN "subtree" t ON c."parentId" = t."id"
          WHERE c."discussionId" = $1
        )
        SELECT * FROM "subtree" ORDER BY "createdAt" ASC
        `,
        params.id,
        parentId
      );
  
      // Build tree (exclude the root if you only want its children)
      const byId = new Map<string, any>();
      const roots: any[] = [];
      for (const r of rows) {
        const n = serializeComment(r);
        (n as any)._children = [];
        byId.set(n.id, n);
      }
      for (const n of byId.values()) {
        if (n.parentId && byId.has(n.parentId)) {
          byId.get(n.parentId)!._children.push(n);
        } else {
          roots.push(n);
        }
      }
  
      // We asked from the parent node down—return its children only:
      const parentNode = byId.get(String(parentId));
      const items = parentNode?._children ?? [];
      return NextResponse.json({ items });
    }
  
    // --- Case B: top-level page + (optional) deep/ direct descendants
    // 1) page of top-level comments (cursor on id desc)
    const topWhere: any = { discussionId: params.id, parentId: null };
    if (cursor) topWhere.id = { lt: BigInt(cursor) };
  
    const top = await prisma.forumComment.findMany({
      where: topWhere,
      orderBy: { id: "desc" },
      take: limit,
      select: {
        id: true, authorId: true, body: true, bodyText: true,
        createdAt: true, score: true, sourceMessageId: true,
        parentId: true, discussionId: true,
      },
    });
    if (top.length === 0) return NextResponse.json({ items: [] });
  
    // Direct children path (kept for compatibility)
    if (!deep && direct) {
      const topIds = top.map((r) => r.id);
      const children = await prisma.forumComment.findMany({
        where: { discussionId: params.id, parentId: { in: topIds } },
        orderBy: { id: "asc" },
        select: {
          id: true, authorId: true, body: true, bodyText: true,
          createdAt: true, score: true, sourceMessageId: true,
          parentId: true, discussionId: true,
        },
      });
  
      const kidsByParent = new Map<string, any[]>();
      for (const r of children) {
        const key = String(r.parentId);
        const list = kidsByParent.get(key) ?? [];
        list.push(serializeComment(r));
        kidsByParent.set(key, list);
      }
  
      const items = top.map((r) => {
        const node = serializeComment(r);
        (node as any)._children = kidsByParent.get(String(r.id)) ?? [];
        return node;
      });
      return NextResponse.json({ items });
    }
  
    // Deep path: recursive CTE to fetch all descendants for this page of tops
    if (deep) {
      const topIds = top.map((r) => String(r.id));
      // Postgres expects bigint[]; build it safely
      const idsArr = `{${topIds.join(",")}}`; // e.g. "{123,124}"
      const rows: any[] = await prisma.$queryRawUnsafe(
        `
        WITH RECURSIVE "tree" AS (
          -- seed with the page's top-level ids
          SELECT c."id", c."discussionId", c."parentId", c."authorId", c."body", c."bodyText", c."createdAt", c."score", c."sourceMessageId"
          FROM "ForumComment" c
          WHERE c."id" = ANY($2::bigint[])
          UNION ALL
          -- descend
          SELECT c."id", c."discussionId", c."parentId", c."authorId", c."body", c."bodyText", c."createdAt", c."score", c."sourceMessageId"
          FROM "ForumComment" c
          JOIN "tree" t ON c."parentId" = t."id"
          WHERE c."discussionId" = $1
        )
        SELECT * FROM "tree" ORDER BY "createdAt" ASC
        `,
        params.id,
        idsArr   // string like "{123,124}"
      );
  
      // Build forest of this page
      const byId = new Map<string, any>();
      for (const r of rows) {
        const n = serializeComment(r);
        (n as any)._children = [];
        byId.set(n.id, n);
      }
      // Parent-child linking
      for (const n of byId.values()) {
        if (n.parentId && byId.has(n.parentId)) {
          byId.get(n.parentId)!._children.push(n);
        }
      }
      // Roots are the top ids we paged
      const roots = top
        .map((r) => byId.get(String(r.id)))
        .filter(Boolean);
  
      return NextResponse.json({ items: roots });
    }
  
    // Default (no replies)
    return NextResponse.json({ items: top.map(serializeComment) });
  }
  

// ---------- POST /api/discussions/[id]/forum
// Body: { parentId?: string|number, content: TipTapJson | string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { parentId, content } = body ?? {};

  const bodyText = toPlainText(content).slice(0, 5000);

    const result = await prisma.$transaction(async (tx) => {



  const created = await prisma.forumComment.create({
    data: {
      discussionId: params.id,
      parentId: parentId ? BigInt(parentId) : null,
      authorId: String(uid), // ForumComment.authorId is string in your schema
      body: content ?? { type: "paragraph", content: [{ type: "text", text: "" }] },
      bodyText,
    },
    select: {
      id: true, authorId: true, body: true, bodyText: true,
      createdAt: true, score: true, sourceMessageId: true, parentId: true,
      discussionId: true,
    },
     });

    // Update discussion activity
    await tx.discussion.update({
      where: { id: params.id },
      data: {
        lastActiveAt: new Date(),
        replyCount: { increment: 1 },
      },
    });

    return created;
  });

  return NextResponse.json({ comment: serializeComment(result) }, { status: 201 });
}