export const dynamic = "force-dynamic";

/**
 * Sync works to ORCID
 * POST - trigger sync of eligible contributions
 * GET - list synced works
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";
import { prisma } from "@/lib/prismaclient";
import { syncAllToOrcid, getSyncedWorks, toggleAutoSync } from "@/lib/credit/orcidService";

export async function POST(req: NextRequest) {
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

    const result = await syncAllToOrcid(dbUser.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("ORCID sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync to ORCID" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
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

    const works = await getSyncedWorks(dbUser.id);

    return NextResponse.json(works);
  } catch (error) {
    console.error("Error fetching synced works:", error);
    return NextResponse.json(
      { error: "Failed to fetch synced works" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
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

    const body = await req.json();
    const { autoSync } = body;

    if (typeof autoSync === "boolean") {
      await toggleAutoSync(dbUser.id, autoSync);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating ORCID settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
