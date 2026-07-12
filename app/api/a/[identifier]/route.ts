/**
 * GET /api/a/:identifier
 * Resolve a permalink and return argument info or redirect (Phase 3.2)
 *
 * This is the public-facing short URL resolver for argument permalinks.
 * Accepts either a shortCode (e.g., "xK3m9pQw") or a slug.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  resolvePermalink,
  incrementPermalinkAccess,
} from "@/lib/citations/permalinkService";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mesh.app";

/**
 * GET - Resolve a permalink identifier
 *
 * For API calls (Accept: application/json), returns argument info.
 * For browser requests, redirects to the argument page.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { identifier: string } }
) {
  try {
    const identifier = params.identifier;

    const result = await resolvePermalink(identifier);

    if (!result) {
      // Check Accept header for API vs browser
      const accept = req.headers.get("accept") || "";
      if (accept.includes("application/json")) {
        return NextResponse.json(
          { ok: false, error: "Permalink not found" },
          { status: 404, ...NO_STORE }
        );
      }

      // Redirect to 404 page for browser requests
      return NextResponse.redirect(`${BASE_URL}/404`);
    }

    // Increment access count in background
    incrementPermalinkAccess(identifier).catch(() => {});

    // Check Accept header for API vs browser
    const accept = req.headers.get("accept") || "";
    if (accept.includes("application/json")) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            argumentId: result.argumentId,
            version: result.version,
          },
        },
        NO_STORE
      );
    }

    // Redirect to argument page for browser requests
    // The actual route depends on the app structure - adjust as needed
    return NextResponse.redirect(
      `${BASE_URL}/arguments/${result.argumentId}`
    );
  } catch (error: any) {
    console.error("[GET /api/a/[identifier]] Error:", error);

    const accept = req.headers.get("accept") || "";
    if (accept.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to resolve permalink" },
        { status: 500, ...NO_STORE }
      );
    }

    return NextResponse.redirect(`${BASE_URL}/500`);
  }
}
