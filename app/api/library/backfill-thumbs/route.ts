// app/api/library/backfill-thumbs/route.ts
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromCookies } from "@/lib/serverutils";

export async function POST(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { stackId } = await req.json().catch(() => ({}));
  if (!stackId) return NextResponse.json({ error: "stackId required" }, { status: 400 });

  const sb = supabaseAdmin();
  const posts = await prisma.libraryPost.findMany({
    where: { stack_id: stackId },
    select: { id: true, file_url: true, thumb_urls: true },
  });

  const enqueued: string[] = [];
  for (const p of posts) {
    if (p.thumb_urls?.[0]) continue;
    if (!p.file_url) continue;
    const m = p.file_url.match(/\/storage\/v1\/object\/public\/pdfs\/(.+\.pdf)$/i);
    if (!m) continue;
    const pdfKey = m[1];
    const pngKey = pdfKey.replace(/\.pdf$/i, ".png");
    try {
      await sb.functions.invoke("pdf-thumb", {
        body: { bucket:"pdfs", path:pdfKey, libraryPostId:p.id, thumbBucket:"pdf-thumbs", thumbPath:pngKey }
      });
      enqueued.push(p.id);
    } catch (e) {
      console.warn("[backfill-thumbs] failed", p.id, e);
    }
  }
  return NextResponse.json({ ok: true, enqueued });
}
