export const dynamic = "force-dynamic";

/**
 * ORCID connection endpoints
 * GET - check connection status or get auth URL
 * DELETE - disconnect ORCID
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";
import { prisma } from "@/lib/prismaclient";
import { getOrcidAuthUrl, getOrcidConnection } from "@/lib/credit/orcidService";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up BigInt user ID
    const dbUser = await prisma.user.findUnique({
      where: { auth_id: user.id },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already connected
    const existing = await getOrcidConnection(dbUser.id);
    if (existing) {
      return NextResponse.json(existing);
    }

    // Generate auth URL
    const state = Buffer.from(
      JSON.stringify({ userId: dbUser.id.toString(), ts: Date.now() })
    ).toString("base64");

    const authUrl = getOrcidAuthUrl(state);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Error with ORCID connection:", error);
    return NextResponse.json(
      { error: "Failed to process ORCID connection" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { auth_id: user.id },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { disconnectOrcid } = await import("@/lib/credit/orcidService");
    await disconnectOrcid(dbUser.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting ORCID:", error);
    return NextResponse.json(
      { error: "Failed to disconnect ORCID" },
      { status: 500 }
    );
  }
}
