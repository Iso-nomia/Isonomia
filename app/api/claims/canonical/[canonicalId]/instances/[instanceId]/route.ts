export const dynamic = "force-dynamic";

/**
 * Phase 3.1: Unlink Claim Instance API
 * DELETE /api/claims/canonical/[canonicalId]/instances/[instanceId] - Unlink claim from canonical
 */

import { NextRequest, NextResponse } from "next/server";
import { unlinkClaimFromCanonical } from "@/lib/provenance/canonicalClaimService";
import { prisma } from "@/lib/prismaclient";
import { createClient } from "@/util/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ canonicalId: string; instanceId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { canonicalId, instanceId } = await params;

    // Get the instance to find the claim ID
    const instance = await prisma.claimInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    if (instance.canonicalClaimId !== canonicalId) {
      return NextResponse.json(
        { error: "Instance does not belong to this canonical claim" },
        { status: 400 }
      );
    }

    await unlinkClaimFromCanonical(instance.claimId, canonicalId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking claim from canonical:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
