/**
 * GET /api/v3/openapi.json
 *
 * Track B.3 \u2014 OpenAPI 3.1 spec for the Isonomia public AI-citation API.
 *
 * Single source of truth: lib/api/isonomiaOpenapi.ts. This route is a
 * thin pass-through; the spec is also rendered via Scalar at
 * /api/v3/docs.
 *
 * Public, edge-cacheable, CORS-open so any agent framework can ingest
 * it directly.
 */
import { NextResponse } from "next/server";
import { ISONOMIA_OPENAPI_SPEC } from "@/lib/api/isonomiaOpenapi";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(ISONOMIA_OPENAPI_SPEC, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
