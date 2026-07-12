export const dynamic = "force-dynamic";

// app/api/library/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";


export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { keys = [] as string[] } = await req.json();
  // return signed URLs for keys that exist
  const results: { key: string; url: string | null }[] = [];
  for (const key of keys) {
    try {
      // HEAD is not supported; we attempt to sign — if missing, Storage returns 404 on GET later
      const { data, error } = await supabase.storage.from("pdf-thumbs").createSignedUrl(key.replace(/^pdf-thumbs\//, ""), 60 * 10);
      results.push({ key, url: error ? null : data?.signedUrl ?? null });
    } catch {
      results.push({ key, url: null });
    }
  }
  return NextResponse.json({ results });
}
