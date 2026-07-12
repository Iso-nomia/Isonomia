export const dynamic = "force-dynamic";

/**
 * DDS Behaviours API Route
 * 
 * GET: List behaviours for a deliberation
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// In-memory mock behaviours store for demo
const mockBehaviours: Record<string, Array<{
  id: string;
  name?: string;
  deliberationId: string;
  participantRole: string;
  closureDesignIds: string[];
  strategyIds: string[];
  createdAt: Date;
}>> = {};

// Initialize demo behaviours
function initDemoBehaviours(deliberationId: string) {
  if (!mockBehaviours[deliberationId]) {
    mockBehaviours[deliberationId] = [
      {
        id: `behaviour-p-${uuidv4().slice(0, 8)}`,
        name: "Proponent Behaviour A",
        deliberationId,
        participantRole: "Proponent",
        closureDesignIds: [`design-p1-${uuidv4().slice(0, 8)}`, `design-p2-${uuidv4().slice(0, 8)}`],
        strategyIds: [`strategy-p1-${uuidv4().slice(0, 8)}`],
        createdAt: new Date(),
      },
      {
        id: `behaviour-p2-${uuidv4().slice(0, 8)}`,
        name: "Proponent Behaviour B",
        deliberationId,
        participantRole: "Proponent",
        closureDesignIds: [`design-p3-${uuidv4().slice(0, 8)}`],
        strategyIds: [`strategy-p2-${uuidv4().slice(0, 8)}`],
        createdAt: new Date(),
      },
      {
        id: `behaviour-o-${uuidv4().slice(0, 8)}`,
        name: "Opponent Behaviour A⊥",
        deliberationId,
        participantRole: "Opponent",
        closureDesignIds: [`design-o1-${uuidv4().slice(0, 8)}`, `design-o2-${uuidv4().slice(0, 8)}`],
        strategyIds: [`strategy-o1-${uuidv4().slice(0, 8)}`],
        createdAt: new Date(),
      },
      {
        id: `behaviour-o2-${uuidv4().slice(0, 8)}`,
        name: "Opponent Behaviour B⊥",
        deliberationId,
        participantRole: "Opponent",
        closureDesignIds: [`design-o3-${uuidv4().slice(0, 8)}`],
        strategyIds: [`strategy-o2-${uuidv4().slice(0, 8)}`],
        createdAt: new Date(),
      },
    ];
  }
  return mockBehaviours[deliberationId];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deliberationId = searchParams.get("deliberationId");
    const behaviourId = searchParams.get("behaviourId");

    // Get specific behaviour
    if (behaviourId) {
      // Search all deliberations for the behaviour
      for (const [delibId, behaviours] of Object.entries(mockBehaviours)) {
        const behaviour = behaviours.find((b) => b.id === behaviourId);
        if (behaviour) {
          return NextResponse.json({
            ok: true,
            behaviour,
          });
        }
      }

      // If deliberationId provided, try to init and search
      if (deliberationId) {
        const behaviours = initDemoBehaviours(deliberationId);
        const behaviour = behaviours.find((b) => b.id === behaviourId);
        if (behaviour) {
          return NextResponse.json({
            ok: true,
            behaviour,
          });
        }
      }

      return NextResponse.json(
        { ok: false, error: "Behaviour not found" },
        { status: 404 }
      );
    }

    // List behaviours for deliberation
    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId is required" },
        { status: 400 }
      );
    }

    const behaviours = initDemoBehaviours(deliberationId);

    return NextResponse.json({
      ok: true,
      behaviours,
      count: behaviours.length,
      deliberationId,
    });
  } catch (error) {
    console.error("GET /api/ludics/dds/behaviours error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to get behaviours" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deliberationId, name, participantRole, closureDesignIds, strategyIds } = body;

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId is required" },
        { status: 400 }
      );
    }

    // Ensure behaviours array exists
    if (!mockBehaviours[deliberationId]) {
      mockBehaviours[deliberationId] = [];
    }

    const newBehaviour = {
      id: `behaviour-${uuidv4().slice(0, 8)}`,
      name: name || `${participantRole || "Unknown"} Behaviour`,
      deliberationId,
      participantRole: participantRole || "Proponent",
      closureDesignIds: closureDesignIds || [],
      strategyIds: strategyIds || [],
      createdAt: new Date(),
    };

    mockBehaviours[deliberationId].push(newBehaviour);

    return NextResponse.json({
      ok: true,
      behaviour: newBehaviour,
    });
  } catch (error) {
    console.error("POST /api/ludics/dds/behaviours error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create behaviour" },
      { status: 500 }
    );
  }
}
