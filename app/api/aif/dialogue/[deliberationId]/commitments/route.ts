export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { getCommitmentStores } from "@/lib/aif/graph-builder";
import { prisma } from "@/lib/prismaclient";

/**
 * GET /api/aif/dialogue/[deliberationId]/commitments
 * 
 * Returns commitment stores for all participants in a deliberation.
 * Shows which claims each participant has committed to (ASSERT, CONCEDE, THEREFORE)
 * and which they have retracted.
 * 
 * Query params:
 * - participantId (optional): Filter to specific participant
 * - asOf (optional): ISO timestamp to get commitments as of a specific point in time
 * - limit (optional): Max commitments per participant (default: 100, max: 500)
 * - offset (optional): Skip first N commitments (default: 0)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { deliberationId: string } }
) {
  const startTime = Date.now();
  
  try {
    // Get current user ID for authorization
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { deliberationId } = params;

    if (!deliberationId) {
      return NextResponse.json(
        { error: "Missing deliberationId parameter" },
        { status: 400 }
      );
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const participantId = searchParams.get("participantId") || undefined;
    const asOf = searchParams.get("asOf") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    // Verify user has access to this deliberation
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { id: true, roomId: true }
    });

    if (!deliberation) {
      return NextResponse.json(
        { error: "Deliberation not found" },
        { status: 404 }
      );
    }

    // TODO: Add room access check when RoomMember model is available.
    // The schema currently has no RoomMember model, so access is gated only
    // by authentication above (matching the commitment-analytics route).

    // Get commitment stores (with caching and pagination)
    const result = await getCommitmentStores(
      deliberationId,
      participantId,
      asOf,
      limit,
      offset
    );

    const duration = Date.now() - startTime;
    console.log(`[commitments] Fetched stores for ${deliberationId} in ${duration}ms (cached: ${result.cached})`);

    return NextResponse.json(result.data, { 
      status: 200,
      headers: {
        'X-Response-Time': `${duration}ms`,
        'X-Cache-Status': result.cached ? 'HIT' : 'MISS'
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error getting commitment stores:", error);
    return NextResponse.json(
      { error: "Failed to get commitment stores" },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${duration}ms`
        }
      }
    );
  }
}
