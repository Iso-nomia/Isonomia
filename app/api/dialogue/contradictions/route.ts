export const dynamic = "force-dynamic";

/**
 * GET /api/dialogue/contradictions
 * 
 * Check for contradictions in a participant's active commitments.
 * Used by UI to show contradiction warnings and indicators.
 * 
 * Query Parameters:
 * - deliberationId: string (required)
 * - participantId: string (required)
 * 
 * Response:
 * {
 *   ok: boolean;
 *   contradictions: Contradiction[];
 *   metadata: {
 *     totalCommitments: number;
 *     contradictionCount: number;
 *     checkedAt: string;
 *   };
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCommitmentStores } from "@/lib/aif/graph-builder";
import {
  analyzeContradictions,
  type ContradictionAnalysis,
} from "@/lib/aif/dialogue-contradictions";

// Simple in-memory cache for contradiction analysis
// TTL: 60 seconds (same as commitment stores)
interface CacheEntry {
  analysis: ContradictionAnalysis;
  timestamp: number;
}

const contradictionCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60 seconds

function getCacheKey(deliberationId: string, participantId: string): string {
  return `${deliberationId}:${participantId}`;
}

function getCachedAnalysis(
  deliberationId: string,
  participantId: string
): ContradictionAnalysis | null {
  const key = getCacheKey(deliberationId, participantId);
  const entry = contradictionCache.get(key);
  
  if (!entry) return null;
  
  // Check if cache entry is still fresh
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) {
    contradictionCache.delete(key);
    return null;
  }
  
  return entry.analysis;
}

function setCachedAnalysis(
  deliberationId: string,
  participantId: string,
  analysis: ContradictionAnalysis
): void {
  const key = getCacheKey(deliberationId, participantId);
  contradictionCache.set(key, {
    analysis,
    timestamp: Date.now(),
  });
  
  // Periodic cleanup of expired entries (every 100 requests)
  if (Math.random() < 0.01) {
    const now = Date.now();
    for (const [k, v] of contradictionCache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) {
        contradictionCache.delete(k);
      }
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deliberationId = searchParams.get("deliberationId");
    const participantId = searchParams.get("participantId");
    
    // Validate required parameters
    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId is required" },
        { status: 400 }
      );
    }
    
    if (!participantId) {
      return NextResponse.json(
        { ok: false, error: "participantId is required" },
        { status: 400 }
      );
    }
    
    // Check cache first
    const cached = getCachedAnalysis(deliberationId, participantId);
    if (cached) {
      return NextResponse.json({
        ok: true,
        contradictions: cached.contradictions,
        metadata: {
          totalCommitments: cached.totalCommitments,
          contradictionCount: cached.contradictions.length,
          checkedAt: cached.checkedAt.toISOString(),
          cached: true,
        },
      });
    }
    
    // Get commitment stores for this deliberation
    const storesResult = await getCommitmentStores(deliberationId);

    // Find participant's store
    const participantStore = storesResult.data.find(
      (store) => store.participantId === participantId
    );
    
    if (!participantStore) {
      // Participant exists but has no commitments yet
      return NextResponse.json({
        ok: true,
        contradictions: [],
        metadata: {
          totalCommitments: 0,
          contradictionCount: 0,
          checkedAt: new Date().toISOString(),
        },
      });
    }
    
    // Convert to simple commitment records for analysis
    const commitments = participantStore.commitments.map((commitment) => ({
      claimId: commitment.claimId,
      claimText: commitment.claimText,
      moveId: commitment.moveId,
      moveKind: commitment.moveKind,
      timestamp: new Date(commitment.timestamp),
      isActive: commitment.isActive,
    }));
    
    // Analyze contradictions
    const analysis = analyzeContradictions(participantId, commitments);
    
    // Cache the result
    setCachedAnalysis(deliberationId, participantId, analysis);
    
    // Return response
    return NextResponse.json({
      ok: true,
      contradictions: analysis.contradictions,
      metadata: {
        totalCommitments: analysis.totalCommitments,
        contradictionCount: analysis.contradictions.length,
        checkedAt: analysis.checkedAt.toISOString(),
        cached: false,
      },
    });
    
  } catch (error) {
    console.error("[API /api/dialogue/contradictions] Error:", error);
    
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
