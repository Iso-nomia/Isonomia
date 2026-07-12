export const dynamic = "force-dynamic";

/**
 * Phase 5.1: Verify equivalence API
 * POST — add verification to an equivalence mapping (authenticated)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";
import { prisma } from "@/lib/prismaclient";
import { verifyEquivalence } from "@/lib/crossfield/conceptService";

type RouteContext = { params: Promise<{ equivalenceId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { equivalenceId } = await context.params;

    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up DB user ID (BigInt) from Supabase auth_id
    const dbUser = await prisma.user.findUnique({
      where: { auth_id: user.id },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await verifyEquivalence(equivalenceId, dbUser.id.toString());

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error verifying equivalence:", error);
    return NextResponse.json(
      { error: "Failed to verify equivalence" },
      { status: 500 }
    );
  }
}
