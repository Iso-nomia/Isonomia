import { createClient } from "@supabase/supabase-js";

Deno.serve(async (req) => {
  try {
    const { bucket, path, libraryPostId, thumbBucket, thumbPath } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const WORKER_URL   = Deno.env.get("THUMBER_URL");       // your renderer HTTP endpoint
    const WORKER_TOKEN = Deno.env.get("THUMBER_BEARER");    // optional bearer for your renderer

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1) Signed *download* URL for the PDF (short TTL)
    const pdfSigned = await sb.storage.from(bucket).createSignedUrl(path, 60 * 5);
    if (!pdfSigned.data?.signedUrl) throw new Error("Failed to sign source PDF");

    // 2) Signed *upload* token for the PNG (no TTL; one-time token)
    const keyOnly = thumbPath.replace(/^pdf-thumbs\//, "");
    const up = await sb.storage.from(thumbBucket).createSignedUploadUrl(keyOnly);
    if (!up.data?.token) throw new Error("Failed to create signed upload");

    // If no renderer configured, bail gracefully (you still have client previews)
    if (!WORKER_URL) {
      console.warn("[pdf-thumb] THUMBER_URL not set; skipping render", { path, libraryPostId });
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { "content-type": "application/json" } });
    }

    // 3) Ask your renderer to:
    //    - fetch the PDF from pdfUrl
    //    - render page 1 → PNG
    //    - upload PNG via signed upload token (no service key!)
    const renderRes = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WORKER_TOKEN ? { Authorization: `Bearer ${WORKER_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        pdfUrl: pdfSigned.data.signedUrl,
        supabaseUrl: SUPABASE_URL,        // for supabase-js on the worker
        thumbBucket,
        thumbPath: keyOnly,
        signedUpload: { token: up.data.token }, // <- secure one-time token
      }),
    });
    if (!renderRes.ok) throw new Error(`Renderer failed ${renderRes.status}`);
    const { pageCount = 1 } = await renderRes.json().catch(() => ({ pageCount: 1 }));

    // 4) Update DB row with the public PNG URL (+ page count)
    const publicThumb = sb.storage.from(thumbBucket).getPublicUrl(keyOnly).data.publicUrl;
    const { error: updErr } = await sb
      .from("library_posts")
      .update({ thumb_urls: publicThumb ? [publicThumb] : [], page_count: pageCount })
      .eq("id", libraryPostId);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error("[pdf-thumb] error", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
