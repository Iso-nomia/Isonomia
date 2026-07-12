export const dynamic = "force-dynamic";

// app/api/library/post/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const post = await prisma.libraryPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      file_url: true,
      page_count: true,
      thumb_urls: true,
    },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let fileUrl = post.file_url;

  // Handle non-PDF blocks that don't have file_url
  if (!fileUrl) {
    return NextResponse.json({
      id: post.id,
      title: post.title,
      fileUrl: null,
      pageCount: post.page_count,
      thumbUrls: post.thumb_urls,
    });
  }

  // If you ever switch back to a private bucket, sign the URL here.
  const isAlreadyPublic = fileUrl.includes("/storage/v1/object/public/");
  const looksLikeSupabasePath = fileUrl.startsWith("pdfs/") || fileUrl.startsWith("private/");
  if (!isAlreadyPublic && looksLikeSupabasePath) {
    // e.g. you stored "pdfs/user_12/foo.pdf"
    const sb = createSupabaseServerClient();
    const { data, error } = await sb.storage
      .from("pdfs")
      .createSignedUrl(fileUrl.replace(/^pdfs\//, ""), 60 * 10 /* 10 mins */);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    fileUrl = data.signedUrl;
  }

  return NextResponse.json({
    id: post.id,
    title: post.title,
    fileUrl,
    pageCount: post.page_count,
    thumbUrls: post.thumb_urls,
  });
}
