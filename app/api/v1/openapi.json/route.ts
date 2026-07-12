export const dynamic = "force-dynamic";

/**
 * OpenAPI Specification Endpoint
 *
 * Serves the OpenAPI spec as JSON.
 *
 * @route GET /api/v1/openapi.json
 */

import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/api/openapi";

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
