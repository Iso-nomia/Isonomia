// app/api/library/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { getOrCreateStackId } from "@/lib/server/stack-helpers";
import { assertCanEditStack } from "@/lib/actions/stack.actions";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- helpers ---------------------------------------------------------------
async function ensureThumbsBucket(sb: ReturnType<typeof supabaseAdmin>) {
  try {
    const { data } = await sb.storage.getBucket("pdf-thumbs");
    if (data) return;
  } catch {}
  try {
    await sb.storage.createBucket("pdf-thumbs", {
      public: true,
      fileSizeLimit: "10MB",
      allowedMimeTypes: ["image/png"],
    });
  } catch {}
}


function safeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parsePreviews(fd: FormData): Array<string | null> {
  const raw = fd.get("previews");
  if (!raw || typeof raw !== "string") return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(v => (typeof v === "string" ? v : null)) : [];
  } catch {
    return [];
  }
}

function dataUrlToBuffer(dataUrl: string): { buf: Buffer; mime: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const buf = Buffer.from(m[2], "base64");
  return { buf, mime };
}

// --- route -----------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromCookies();
    if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    // Identify user (Firebase cookie) — dev override header allowed
    const devHeader = req.headers.get("x-dev-user-id");

   //const userId = devHeader ? BigInt(devHeader) : await getCurrentUserId();
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const form = await req.formData();
    const stackIdParam = form.get("stackId")?.toString() || undefined;
    const stackName = form.get("stackName")?.toString() || undefined;
    const isPublic = form.get("isPublic") === "true";

    if (stackIdParam) {
      try {
        if (user.userId == null) {
          return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
        }
        await assertCanEditStack(stackIdParam, BigInt(user.userId));
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || "Forbidden" }, { status: 403 });
      }
    }

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }
const previews = parsePreviews(form);

   if (previews.length && previews.length !== files.length) {
     console.warn("[upload] previews length mismatch", { previews: previews.length, files: files.length });
   }
    if (user.userId == null) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    const stackId = await getOrCreateStackId({
      ownerId: BigInt(user.userId),
      stackId: stackIdParam,
      stackName,
      isPublic,
    });

    const sb = supabaseAdmin(); // service-role client
await ensureThumbsBucket(sb);

    const postIds: string[] = [];
    const coverUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
      if (ext !== "pdf") {
        return NextResponse.json({ error: `Only PDF allowed: ${f.name}` }, { status: 400 });
      }

      // Unique storage key: user_<id>/<ts>_<rand>_<filename>.pdf
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const baseKey = `user_${userId}/${ts}_${i}_${rand}_${safeFileName(f.name)}`;
      const pdfKey = baseKey.endsWith(".pdf") ? baseKey : `${baseKey}.pdf`;
      const pngKey = pdfKey.replace(/\.pdf$/i, ".png"); // used for preview & function

      // Upload PDF
      const ab = await f.arrayBuffer();
      const { error: upErr } = await sb.storage
        .from("pdfs")
        .upload(pdfKey, Buffer.from(ab), {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upErr) {
        console.error("[upload] pdf error", upErr);
        return NextResponse.json({ error: upErr.message || "Upload failed" }, { status: 500 });
      }

      const { data: pubPdf } = sb.storage.from("pdfs").getPublicUrl(pdfKey);
      const fileUrl = pubPdf?.publicUrl ?? "";

      // Optional preview upload (instant cover for UI)
      let thumbUrl: string | undefined;
      const preview = previews[i];
      if (typeof preview === "string") {
        const parsed = dataUrlToBuffer(preview);
        if (parsed) {
          const { error: thErr } = await sb.storage
            .from("pdf-thumbs")
            .upload(pngKey, parsed.buf, {
              contentType: parsed.mime || "image/png",
              upsert: true, // allow worker to overwrite later if needed
            });

          if (!thErr) {
            const { data: pubPng } = sb.storage.from("pdf-thumbs").getPublicUrl(pngKey);
            thumbUrl = pubPng?.publicUrl || undefined;
          } else {
            console.warn("[upload] thumb upload failed", thErr.message);
          }
        }
      }

      // Create LibraryPost row
      const lp = await prisma.libraryPost.create({
        data: {
          uploader_id: userId,
          stack_id: stackId || null,
          title: f.name,
          page_count: 0, // worker/edge will update later
          file_url: fileUrl,
          thumb_urls: thumbUrl ? [thumbUrl] : [],
        },
        select: { id: true, thumb_urls: true },
      });

   postIds.push(lp.id);
 coverUrls.push(lp.thumb_urls?.[0] ?? ""); // keep alignment

    //   // Kick off server-side thumbnailing (robust even if no client preview)
    //   try {
    //     await sb.functions.invoke("pdf-thumb", {
    //       body: {
    //         bucket: "pdfs",
    //         path: pdfKey,          // STORAGE KEY
    //         libraryPostId: lp.id,
    //         thumbBucket: "pdf-thumbs",
    //         thumbPath: pngKey,     // path inside the bucket
    //       },
    //     });
    //   } catch (e: any) {
    //     console.warn("[upload] pdf-thumb invoke failed:", e?.message || e);
    //   }
     }

    // Merge new ids into order (don't hide existing posts)
    if (stackId && postIds.length) {
      const existing = await prisma.stack.findUnique({
        where: { id: stackId },
        select: { order: true },
      });
      const prev = existing?.order ?? [];
      const next = Array.from(new Set([...postIds, ...prev]));
      await prisma.stack.update({
        where: { id: stackId },
        data: { order: next },
      });
    }

    // Small feed event
    if (stackId && postIds.length > 0) {
      const stackInfo = await prisma.stack.findUnique({
        where: { id: stackId },
        select: { is_public: true, name: true },
      });
      await prisma.feedPost.create({
        data: {
          author_id: user.userId ? BigInt(user.userId) : 0n,
          type: "TEXT",
          isPublic: stackInfo?.is_public ?? true,
          content: `added ${postIds.length} item${postIds.length > 1 ? "s" : ""} to`,
          stack_id: stackId,
          caption: stackInfo?.name,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      stackId: stackId || null,
      postIds,
      coverUrls,
    });
  } catch (err: any) {
    console.error("[library/upload] error", err);
    return NextResponse.json(
      { error: String(err?.message || err || "Unknown error") },
      { status: 500 }
    );
  }
}
