export const dynamic = "force-dynamic";

/**
 * Conflict resolution API
 * POST: Apply resolution strategy to conflict
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { detectConflicts } from "@/lib/aspic/conflicts/detection";
import { suggestResolutionStrategies, applyResolution } from "@/lib/aspic/conflicts/resolution";
import { getUserFromCookies } from "@/lib/serverutils";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const ResolveRequest = z.object({
  deliberationId: z.string().min(6),
  conflictIndex: z.number().int().min(0),
  strategyType: z.enum(["remove_weakest", "remove_oldest", "user_selection", "vote_based"]),
  manualPAIds: z.array(z.string()).optional(), // For user_selection
});

export async function POST(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, ...NO_STORE }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, ...NO_STORE }
    );
  }

  const parsed = ResolveRequest.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400, ...NO_STORE }
    );
  }

  const { deliberationId, conflictIndex, strategyType, manualPAIds } = parsed.data;

  try {
    // Get conflicts
    const conflicts = await detectConflicts(deliberationId);

    if (conflictIndex >= conflicts.length) {
      return NextResponse.json(
        { error: "Conflict not found", conflictIndex, totalConflicts: conflicts.length },
        { status: 404, ...NO_STORE }
      );
    }

    const conflict = conflicts[conflictIndex];

    // Get strategies
    const strategies = suggestResolutionStrategies(conflict);
    let selectedStrategy = strategies.find(s => s.type === strategyType);

    if (!selectedStrategy) {
      return NextResponse.json(
        { 
          error: "Strategy not found",
          availableStrategies: strategies.map(s => s.type),
        },
        { status: 400, ...NO_STORE }
      );
    }

    // Handle manual selection
    if (strategyType === "user_selection") {
      if (!manualPAIds || manualPAIds.length === 0) {
        return NextResponse.json(
          { error: "Manual selection requires at least one PA ID" },
          { status: 400, ...NO_STORE }
        );
      }

      // Validate that manual PAs are actually in the conflict
      const conflictPAIds = conflict.preferences.map(p => p.id);
      const invalidPAIds = manualPAIds.filter(id => !conflictPAIds.includes(id));
      
      if (invalidPAIds.length > 0) {
        return NextResponse.json(
          { 
            error: "Some PA IDs are not part of this conflict",
            invalidPAIds,
            validPAIds: conflictPAIds,
          },
          { status: 400, ...NO_STORE }
        );
      }

      selectedStrategy = {
        ...selectedStrategy,
        toRemove: manualPAIds,
      };
    }

    // Apply resolution
    const result = await applyResolution(
      selectedStrategy,
      user.uid,
      deliberationId
    );

    return NextResponse.json(
      {
        success: true,
        removed: result.removed,
        remainingConflicts: result.newCycles,
        message: result.newCycles === 0 
          ? "All conflicts resolved!" 
          : `${result.newCycles} conflict(s) remaining`,
      },
      NO_STORE
    );
  } catch (error) {
    console.error("Resolution error:", error);
    return NextResponse.json(
      { 
        error: "Failed to apply resolution",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, ...NO_STORE }
    );
  }
}
