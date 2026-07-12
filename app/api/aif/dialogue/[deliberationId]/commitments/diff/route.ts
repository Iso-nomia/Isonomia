export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { getCommitmentStores } from "@/lib/aif/graph-builder";
import { prisma } from "@/lib/prismaclient";

/**
 * GET /api/aif/dialogue/[deliberationId]/commitments/diff
 * 
 * Compare commitment states between two points in time.
 * Returns added and removed commitments for each participant.
 * 
 * Query params:
 * - from (required): ISO timestamp for the "before" state
 * - to (optional): ISO timestamp for the "after" state (defaults to now)
 * - participantId (optional): Filter to specific participant
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { deliberationId: string } }
) {
  const startTime = Date.now();
  
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { deliberationId } = params;
    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to") || undefined;
    const participantId = searchParams.get("participantId") || undefined;

    if (!from) {
      return NextResponse.json(
        { error: "Missing required 'from' parameter" },
        { status: 400 }
      );
    }

    // Validate timestamp format
    const fromDate = new Date(from);
    const toDate = to ? new Date(to) : new Date();
    
    if (isNaN(fromDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid 'from' timestamp format" },
        { status: 400 }
      );
    }
    
    if (to && isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid 'to' timestamp format" },
        { status: 400 }
      );
    }

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

    if (deliberation.roomId) {
      // Check if user is a member of the room
      const member = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "RoomMember"
        WHERE "roomId" = ${deliberation.roomId}
          AND "userId" = ${userId}
      `;

      if (!member[0] || Number(member[0].count) === 0) {
        return NextResponse.json(
          { error: "Access denied to this deliberation" },
          { status: 403 }
        );
      }
    }

    // Get commitment states at both timestamps
    const beforeResult = await getCommitmentStores(
      deliberationId,
      participantId,
      from,
      1000, // Get all commitments for diff
      0
    );
    
    const afterResult = await getCommitmentStores(
      deliberationId,
      participantId,
      to,
      1000,
      0
    );

    // Build maps of active commitments at each timestamp
    interface CommitmentMap {
      [participantId: string]: {
        [claimId: string]: {
          claimText: string;
          moveId: string;
          timestamp: string;
        };
      };
    }

    const buildCommitmentMap = (stores: any[]): CommitmentMap => {
      const map: CommitmentMap = {};
      for (const store of stores) {
        map[store.participantId] = {};
        for (const commitment of store.commitments || []) {
          if (commitment.isActive) {
            map[store.participantId][commitment.claimId] = {
              claimText: commitment.claimText,
              moveId: commitment.moveId,
              timestamp: commitment.timestamp,
            };
          }
        }
      }
      return map;
    };

    const beforeMap = buildCommitmentMap(beforeResult.data);
    const afterMap = buildCommitmentMap(afterResult.data);

    // Compute diff: added and removed commitments per participant
    const allParticipants = new Set([
      ...Object.keys(beforeMap),
      ...Object.keys(afterMap),
    ]);

    const diff = Array.from(allParticipants).map(participantId => {
      const beforeClaims = beforeMap[participantId] || {};
      const afterClaims = afterMap[participantId] || {};

      const added = Object.keys(afterClaims)
        .filter(claimId => !beforeClaims[claimId])
        .map(claimId => ({
          claimId,
          claimText: afterClaims[claimId].claimText,
          moveId: afterClaims[claimId].moveId,
          timestamp: afterClaims[claimId].timestamp,
        }));

      const removed = Object.keys(beforeClaims)
        .filter(claimId => !afterClaims[claimId])
        .map(claimId => ({
          claimId,
          claimText: beforeClaims[claimId].claimText,
          moveId: beforeClaims[claimId].moveId,
          timestamp: beforeClaims[claimId].timestamp,
        }));

      const unchanged = Object.keys(beforeClaims)
        .filter(claimId => afterClaims[claimId])
        .map(claimId => ({
          claimId,
          claimText: beforeClaims[claimId].claimText,
        }));

      // Get participant name from either result
      let participantName = "Unknown";
      const beforeStore = beforeResult.data.find((s: any) => s.participantId === participantId);
      const afterStore = afterResult.data.find((s: any) => s.participantId === participantId);
      if (beforeStore) participantName = beforeStore.participantName;
      else if (afterStore) participantName = afterStore.participantName;

      return {
        participantId,
        participantName,
        added,
        removed,
        unchanged,
        summary: {
          addedCount: added.length,
          removedCount: removed.length,
          unchangedCount: unchanged.length,
          totalBefore: Object.keys(beforeClaims).length,
          totalAfter: Object.keys(afterClaims).length,
        },
      };
    });

    const duration = Date.now() - startTime;
    
    return NextResponse.json(
      {
        deliberationId,
        timeRange: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        participantDiffs: diff,
        summary: {
          totalParticipants: diff.length,
          totalAdded: diff.reduce((sum, d) => sum + d.added.length, 0),
          totalRemoved: diff.reduce((sum, d) => sum + d.removed.length, 0),
          totalUnchanged: diff.reduce((sum, d) => sum + d.unchanged.length, 0),
        },
      },
      {
        status: 200,
        headers: {
          "X-Response-Time": `${duration}ms`,
        },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error computing commitment diff:", error);
    return NextResponse.json(
      { error: "Failed to compute commitment diff" },
      { 
        status: 500,
        headers: {
          "X-Response-Time": `${duration}ms`
        }
      }
    );
  }
}
