export const dynamic = "force-dynamic";

/**
 * Ch(S) API Endpoint
 * 
 * Extract all chronicles from strategy S
 */

import { NextRequest, NextResponse } from "next/server";
import { computeCh, computeChOptimized } from "@/packages/ludics-core/dds/correspondence";
import type { Strategy } from "@/packages/ludics-core/dds/strategy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { strategy, optimized = false } = body as {
      strategy: Strategy;
      optimized?: boolean;
    };

    if (!strategy) {
      return NextResponse.json(
        { ok: false, error: "strategy is required" },
        { status: 400 }
      );
    }

    // Compute Ch(S)
    const result = optimized 
      ? computeChOptimized(strategy)
      : computeCh(strategy);

    return NextResponse.json({
      ok: true,
      strategyId: result.strategyId,
      chronicles: result.chronicles,
      count: result.count,
      computedAt: result.computedAt,
      optimized,
    });
  } catch (error: any) {
    console.error("Error computing Ch(S):", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to extract chronicles" },
      { status: 500 }
    );
  }
}
