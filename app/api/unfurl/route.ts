/**
 * GET /api/unfurl?url={encodedUrl}
 *
 * Phase 2 (Step 2.6): Lightweight URL metadata extraction for the
 * Quick Argument Builder's evidence auto-fill.
 *
 * Security: server-side fetch only; SSRF protection via isSafePublicUrl.
 * Rate limit: 60 unfurls per user per hour.
 */
import { NextRequest, NextResponse } from "next/server";
import { isSafePublicUrl, getOrFetchLinkPreview } from "@/lib/unfurl";
import { getCurrentUserId } from "@/lib/serverutils";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

// ─── Rate limiter: 60 unfurls per user per hour ───────────────────────────────
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.fixedWindow(60, "1 h"),
  prefix: "rl:unfurl",
});

export async function GET(req: NextRequest) {
  // Auth
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const { success: withinLimit } = await ratelimit.limit(String(userId));
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Rate limit exceeded — max 60 URL previews per hour" },
      { status: 429 }
    );
  }

  // Extract and validate URL param
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url encoding" }, { status: 400 });
  }

  // SSRF guard
  if (!isSafePublicUrl(decodedUrl)) {
    return NextResponse.json(
      { error: "URL is not a safe public HTTP/HTTPS URL" },
      { status: 400 }
    );
  }

  try {
    const preview = await getOrFetchLinkPreview(decodedUrl);

    return NextResponse.json(
      {
        ok: true,
        data: {
          title: preview.title ?? null,
          description: preview.desc ?? null,
          image: preview.image ?? null,
          siteName: null, // not stored separately in LinkPreview — derive from host if needed
          url: decodedUrl,
          favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(decodedUrl).hostname)}&sz=32`,
        },
      },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } }
    );
  } catch (e: any) {
    console.error("[GET /api/unfurl]", e);
    return NextResponse.json(
      { error: "Failed to fetch URL metadata" },
      { status: 500 }
    );
  }
}
