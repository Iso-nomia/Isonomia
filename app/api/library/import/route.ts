export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { assertCanEditStack } from "@/lib/actions/stack.actions";
import { getOrCreateStackId } from "@/lib/server/stack-helpers";

// --- helpers ---------------------------------------------------------------
function dataUrlToBuffer(dataUrl: string): { buf: Buffer; mime: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], buf: Buffer.from(m[2], "base64") };
}
function sanitizeFileName(name: string, ext = ".pdf") {
  const base = name.replace(/\.pdf$/i, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const ascii = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
  const trimmed = ascii.replace(/^[_\.]+|[_\.]+$/g, "");
  return (trimmed || "document") + ext;
}
function buildKey(userId: bigint | number | string, rawName: string) {
  const safe = sanitizeFileName(rawName);
  return `user_${userId}/${Date.now()}_${safe}`;
}
async function ensureThumbsBucket(sb: ReturnType<typeof supabaseAdmin>) {
  try {
    const { data } = await sb.storage.getBucket("pdf-thumbs");
    if (data) return;
  } catch {}
  // If it doesn't exist, try to create it; ignore errors if it already exists.
  try {
    await sb.storage.createBucket("pdf-thumbs", {
      public: true,
      fileSizeLimit: "10MB",
      allowedMimeTypes: ["image/png"],
    });
  } catch {}
}

// --- route -----------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const sb = supabaseAdmin();
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const payload = await req.json();
    const objects      = payload.objects ?? [];
    const externalUrls = payload.urls ?? payload.externalUrls ?? [];
    const previews     = Array.isArray(payload.previews) ? payload.previews : []; // string|null[]
    const stackIdParam = payload.stackId ?? null;
    const stackName    = payload.stackName ?? "My Library";
    const isPublic     = payload.isPublic ?? true;

    if (stackIdParam) {
      try {
        await assertCanEditStack(stackIdParam, userId);
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || "Forbidden" }, { status: 403 });
      }
    }
    const stackId = await getOrCreateStackId({
      ownerId: userId,
      stackId: stackIdParam ?? undefined,
      stackName,
      isPublic,
    });

    await ensureThumbsBucket(sb);

    const postIds: string[] = [];
    const coverUrls: string[] = [];

    // A) Objects (already in storage)
    for (const obj of objects as Array<{ bucket: string; path: string; title?: string; thumbPath?: string }>) {
      const publicPdf = sb.storage.from("pdfs").getPublicUrl(obj.path.replace(/^pdfs\//, "")).data.publicUrl ?? obj.path;
      const publicPng = obj.thumbPath
        ? sb.storage.from("pdf-thumbs").getPublicUrl(obj.thumbPath.replace(/^pdf-thumbs\//, "")).data.publicUrl
        : undefined;

      const created = await prisma.libraryPost.create({
        data: {
          uploader_id: userId,
          stack_id: stackId!,
          title: obj.title ?? null,
          page_count: 0,
          file_url: publicPdf,
          thumb_urls: publicPng ? [publicPng] : [],
        },
        select: { id: true, thumb_urls: true },
      });
      postIds.push(created.id);
      coverUrls.push(created.thumb_urls?.[0] ?? "");
    }

    // B) External URLs (download → upload → optional preview)
    for (let i = 0; i < externalUrls.length; i++) {
      const url = externalUrls[i];
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`);
      const ab = await resp.arrayBuffer();

      const nameGuess = url.split("?")[0].split("#")[0].split("/").pop() || "document.pdf";
      const pdfKey = buildKey(userId, nameGuess);

      const up = await sb.storage.from("pdfs").upload(pdfKey, Buffer.from(ab), {
        contentType: "application/pdf",
        upsert: true,
      });
      if (up.error) throw new Error(up.error.message);

      const publicUrl = sb.storage.from("pdfs").getPublicUrl(pdfKey).data.publicUrl ?? up.data.path;

      const created = await prisma.libraryPost.create({
        data: {
          uploader_id: userId,
          stack_id: stackId!,
          title: nameGuess,
          page_count: 0,
          file_url: publicUrl,
          thumb_urls: [],
        },
        select: { id: true },
      });
      postIds.push(created.id);

      // Upload preview PNG if provided
      const preview = previews[i];
      if (typeof preview === "string") {
        const parsed = dataUrlToBuffer(preview);
        if (parsed) {
          const pngKey = pdfKey.replace(/\.pdf$/i, ".png");
          const upThumb = await sb.storage.from("pdf-thumbs").upload(pngKey, parsed.buf, {
            contentType: parsed.mime || "image/png",
            upsert: true,
          });
          if (!upThumb.error) {
            const pubThumb = sb.storage.from("pdf-thumbs").getPublicUrl(pngKey).data.publicUrl;
            await prisma.libraryPost.update({
              where: { id: created.id },
              data: { thumb_urls: pubThumb ? [pubThumb] : [] },
            });
            coverUrls.push(pubThumb ?? "");
          } else {
            coverUrls.push("");
          }
        } else {
          coverUrls.push("");
        }
      } else {
        coverUrls.push("");
      }
    }

    // Merge order so new posts appear first
    if (stackId && postIds.length) {
      const existing = await prisma.stack.findUnique({ where: { id: stackId }, select: { order: true } });
      const next = Array.from(new Set([...postIds, ...(existing?.order ?? [])]));
      await prisma.stack.update({ where: { id: stackId }, data: { order: next } });
    }

    return NextResponse.json({ stackId, postIds, coverUrls });
  } catch (e: any) {
    console.error("IMPORT_ERR:", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
