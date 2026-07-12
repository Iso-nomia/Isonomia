export const dynamic = "force-dynamic";

// app/api/citations/zotero/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import crypto from "crypto";

function fp(s: string) { return crypto.createHash("sha1").update(s).digest("hex"); }

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const data = await req.json().catch(() => null);
  if (!Array.isArray(data)) return NextResponse.json({ error: "Expected Zotero JSON array" }, { status: 400 });

  const created: string[] = [];
  for (const it of data) {
    const url = it.url?.trim() || null;
    const doi = it.DOI?.trim() || null;
    const title = it.title || null;
    const year = it.date ? Number(String(it.date).slice(0, 4)) || null : null;

    const fingerprint = fp(`${doi || ""}|${url || ""}|${title || ""}`);

    const exists = await prisma.source.findFirst({ where: { fingerprint } });
    if (exists) continue;

    const authors =
      Array.isArray(it.creators)
        ? it.creators
            .filter((c: any) => c?.lastName || c?.family)
            .map((c: any) => ({ family: c.lastName || c.family, given: c.firstName || c.given }))
        : [];

    const row = await prisma.source.create({
      data: {
        kind: it.itemType || "article-journal",
        title,
        authorsJson: authors.length ? authors : null,
        year,
        container: it.publicationTitle || it.websiteTitle || null,
        publisher: it.publisher || null,
        volume: it.volume || null,
        issue: it.issue || null,
        pages: it.pages || null,
        doi,
        url,
        platform: null,
        accessedAt: it.accessDate ? new Date(it.accessDate) : null,
        archiveUrl: null,
        zoteroKey: it.key || null,
        libraryPostId: null,
        fingerprint,
        createdById: String(userId),
      },
      select: { id: true },
    });
    created.push(row.id);
  }

  return NextResponse.json({ ok: true, createdCount: created.length, ids: created });
}
