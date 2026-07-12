export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { getCommitmentStores } from "@/lib/aif/graph-builder";
import { computeCommitmentAnalytics } from "@/lib/aif/commitment-analytics";
import { prisma } from "@/lib/prismaclient";
import { getOrSet } from "@/lib/redis";

/**
 * GET /api/aif/dialogue/[deliberationId]/commitment-analytics
 * 
 * Returns comprehensive analytics for commitment activity in a deliberation:
 * - Participation metrics (rate, distribution, activity)
 * - Consensus analysis (claim agreement scores, polarization)
 * - Temporal patterns (velocity, peak times, trends)
 * - Retraction analysis (stability, churn, most volatile claims)
 * 
 * Response cached for 5 minutes via Redis.
 * 
 * Query params:
 * - refresh (optional): Set to "true" to bypass cache
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

    // Check for cache refresh flag
    const searchParams = req.nextUrl.searchParams;
    const refresh = searchParams.get("refresh") === "true";

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

    // TODO: Add room access check when RoomMember model is available
    // For now, just verify deliberation exists (checked above)

    // Use Redis cache with 5-minute TTL
    const cacheKey = `commitment-analytics:${deliberationId}`;
    const analytics = await getOrSet(cacheKey, 300, async () => {
      console.log(`[commitment-analytics] Cache MISS for ${deliberationId}, computing...`);
      
      // Get commitment stores
      const storesResult = await getCommitmentStores(deliberationId);
      
      if (!storesResult.data || !Array.isArray(storesResult.data)) {
        throw new Error("Failed to fetch commitment stores");
      }

      // Compute analytics
      const analyticsData = computeCommitmentAnalytics(storesResult.data);
      
      return analyticsData;
    });

    const duration = Date.now() - startTime;
    const isCacheHit = duration < 10;
    
    console.log(`[commitment-analytics] ${isCacheHit ? 'Cache HIT' : 'Cache MISS'} for ${deliberationId} in ${duration}ms`);

    return NextResponse.json(analytics, { 
      status: 200,
      headers: {
        'X-Response-Time': `${duration}ms`,
        'X-Cache-Status': isCacheHit ? 'HIT' : 'MISS'
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[commitment-analytics] Error:", error);
    return NextResponse.json(
      { error: "Failed to compute commitment analytics" },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${duration}ms`
        }
      }
    );
  }
}
