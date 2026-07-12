// app/api/citations/resolve/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

function canonicalUrl(u?: string | null) {
  if (!u) return null;
  try {
    const url = new URL(u);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) =>
      url.searchParams.delete(k),
    );
    return url.toString();
  } catch {
    return u.trim();
  }
}
function inferPlatform(u?: string | null) {
  if (!u) return "web";
  try {
    const h = new URL(u).hostname;
    if (h.includes("arxiv")) return "arxiv";
    if (h.includes("substack")) return "substack";
    if (h.includes("youtube") || h.includes("youtu.be")) return "youtube";
    return "web";
  } catch {
    return "web";
  }
}
function fpFrom(parts: {
  doi?: string | null;
  url?: string | null;
  libraryPostId?: string | null;
  workId?: string | null;
}) {
  const base =
    (parts.doi?.toLowerCase() || "") +
    "|" +
    (parts.url?.toLowerCase() || "") +
    "|" +
    (parts.libraryPostId || "") +
    "|" +
    (parts.workId || "");
  return crypto.createHash("sha1").update(base, "utf8").digest("hex");
}

/** Resolve or create a minimal Source row from a URL/DOI/internal work/stack item. */
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as any;
  const meta = (body.meta ?? {}) as Partial<{
    kind: string;
    title: string;
    authorsJson: any;
    year: number;
    container: string;
    publisher: string;
    platform: string;
    accessedAt: string;
    zoteroKey: string;
  }>;

  // Normalize to a single "input"
  const input =
    body.ref
      ? body.ref
      : body.workId
      ? { kind: "work", id: String(body.workId) }
      : body.libraryPostId
      ? { kind: "stack:item", itemId: String(body.libraryPostId) }
      : body.doi
      ? { kind: "uri", url: `https://doi.org/${String(body.doi).trim()}`, doi: String(body.doi).trim() }
      : body.url
      ? { kind: "uri", url: String(body.url) }
      : null;

  if (!input) {
    return NextResponse.json({ error: "Provide ref/url/doi/libraryPostId/workId" }, { status: 400 });
  }

  let row: { id: string; title: string | null; url: string | null } | null = null;

  // --- 1) URI (web or DOI URL) ---
  if (input.kind === "uri") {
    const norm = canonicalUrl(input.url) as string;
    const doiFromBody = body?.doi ? String(body.doi).trim() : undefined;
    const fingerprint = fpFrom({ url: norm, doi: doiFromBody });

    const existing = await prisma.source.findFirst({
      where: {
        OR: [
          { fingerprint },
          ...(norm ? [{ url: norm }] : []),
          ...(doiFromBody ? [{ doi: doiFromBody }] : []),
        ],
      },
      select: { id: true, title: true, url: true, doi: true, fingerprint: true },
    });

    if (existing) {
      const upd = await prisma.source.update({
        where: { id: existing.id },
        data: {
          url: existing.url ?? norm,
          doi: existing.doi ?? doiFromBody ?? undefined,
          title: existing.title ?? meta.title ?? null,
          platform: (existing as any).platform ?? meta.platform ?? inferPlatform(norm),
          kind: (existing as any).kind ?? meta.kind ?? "web",
          authorsJson: (existing as any).authorsJson ?? (meta.authorsJson ?? undefined),
          year: (existing as any).year ?? (meta.year ?? undefined),
          container: (existing as any).container ?? (meta.container ?? undefined),
          publisher: (existing as any).publisher ?? (meta.publisher ?? undefined),
          accessedAt: (existing as any).accessedAt ?? (meta.accessedAt ? new Date(meta.accessedAt) : new Date()),
          fingerprint: existing.fingerprint ?? fingerprint,
        },
        select: { id: true, title: true, url: true },
      });
      row = upd;
    } else {
      row = await prisma.source.create({
        data: {
          kind: meta.kind ?? "web",
          title: meta.title ?? norm,
          url: norm,
          doi: doiFromBody ?? undefined,
          platform: meta.platform ?? inferPlatform(norm),
          authorsJson: meta.authorsJson ?? undefined,
          year: meta.year ?? undefined,
          container: meta.container ?? undefined,
          publisher: meta.publisher ?? undefined,
          accessedAt: meta.accessedAt ? new Date(meta.accessedAt) : new Date(),
          fingerprint,
          createdById: String(userId),
        },
        select: { id: true, title: true, url: true },
      });

      // Fire-and-forget Wayback snapshot for web links
      if (!doiFromBody && norm) {
        fetch(`https://web.archive.org/save/${encodeURIComponent(norm)}`).catch(() => {});
      }
    }
  }

  // --- 2) WORK (internal) ---
  if (input.kind === "work") {
    const workId = String(input.id);
    const fingerprint = fpFrom({ workId });
    const existing = await prisma.source.findFirst({
      where: { fingerprint },
      select: { id: true, title: true, url: true },
    });
    row =
      existing ??
      (await prisma.source.create({
        data: {
          kind: meta.kind ?? "work",
          title: meta.title ?? null,
          url: `/works/${workId}`,
          platform: meta.platform ?? "internal",
          fingerprint,
          createdById: String(userId),
        },
        select: { id: true, title: true, url: true },
      }));
  }

  // --- 3) STACK ITEM (LibraryPost) ---
  if (input.kind === "stack:item") {
    const lp = await prisma.libraryPost.findUnique({
      where: { id: String(input.itemId) },
      select: { id: true, title: true },
    });
    if (!lp) return NextResponse.json({ error: "Library item not found" }, { status: 404 });

    const fingerprint = fpFrom({ libraryPostId: lp.id });
    const existing = await prisma.source.findFirst({
      where: { OR: [{ fingerprint }, { libraryPostId: lp.id }] },
      select: { id: true, title: true, url: true },
    });

    row =
      existing ??
      (await prisma.source.create({
        data: {
          kind: meta.kind ?? "pdf",
          title: meta.title ?? lp.title ?? "PDF",
          platform: meta.platform ?? "library",
          libraryPostId: lp.id,
          fingerprint,
          createdById: String(userId),
        },
        select: { id: true, title: true, url: true },
      }));
  }

  // Bus (safe)
  try {
    (globalThis as any).__meshBus__?.emitEvent?.("citations:changed", { sourceId: row?.id });
  } catch {}

  return NextResponse.json({ source: row });
}
