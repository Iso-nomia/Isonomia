/**
 * ORCID OAuth callback
 * Handles the redirect from ORCID after authorization
 */

import { NextRequest, NextResponse } from "next/server";
import { connectOrcid } from "@/lib/credit/orcidService";

// OAuth callback: reads request query params and hits external services at
// request time; must never be statically prerendered.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?orcid_error=${error}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?orcid_error=missing_params`
      );
    }

    // Decode state
    const { userId } = JSON.parse(Buffer.from(state, "base64").toString());

    // Connect ORCID
    await connectOrcid(BigInt(userId), code);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?orcid_success=true`
    );
  } catch (error) {
    console.error("ORCID callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?orcid_error=connection_failed`
    );
  }
}
