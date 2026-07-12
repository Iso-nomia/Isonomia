export const dynamic = "force-dynamic";

/**
 * DDS Arena Positions API Route
 * 
 * POST: Enumerate or validate positions in an arena
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createUniversalArena,
  enumerateLegalPositions,
  validatePosition,
  computePView,
  computeOView,
  getAvailableMoves,
  createArenaMove,
  getArenaStats,
} from "@/packages/ludics-core/dds/arena/client";
import type { ArenaMove, UniversalArena } from "@/packages/ludics-core/dds/arena/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      action, 
      arenaConfig, 
      sequence, 
      maxDepth, 
      maxPositions 
    } = body;

    // Build or receive arena
    let arena: UniversalArena;
    if (arenaConfig?.moves) {
      // Arena provided directly
      arena = arenaConfig as UniversalArena;
    } else {
      // Create arena from config
      arena = createUniversalArena({
        maxDepth: arenaConfig?.maxDepth ?? 3,
        maxRamification: arenaConfig?.maxRamification ?? 3,
      });
    }

    switch (action) {
      case "enumerate": {
        // Enumerate legal positions
        const positions = enumerateLegalPositions(
          arena,
          maxDepth ?? 4,
          maxPositions ?? 100
        );

        return NextResponse.json({
          ok: true,
          positionCount: positions.length,
          positions: positions.map((p) => ({
            id: p.id,
            length: p.length,
            currentPlayer: p.currentPlayer,
            isTerminal: p.isTerminal,
            isValid: p.validity.isValid,
            sequence: p.sequence.map((m) => ({
              address: m.address,
              player: m.player,
              ramification: m.ramification,
            })),
          })),
          arenaStats: getArenaStats(arena),
        });
      }

      case "validate": {
        // Validate a specific sequence
        if (!sequence || !Array.isArray(sequence)) {
          return NextResponse.json(
            { ok: false, error: "sequence is required for validate action" },
            { status: 400 }
          );
        }

        // Convert sequence to ArenaMove[]
        const moves: ArenaMove[] = sequence.map((s: any, idx: number) => 
          createArenaMove(s.address, s.ramification || [], {
            id: s.id || `move-${idx}`,
            justifierId: s.justifierId,
          })
        );

        const validity = validatePosition(moves, arena);

        // Compute views
        const tempPosition = {
          id: "temp",
          arenaId: arena.id,
          sequence: moves,
          length: moves.length,
          currentPlayer: moves.length % 2 === 0 ? "P" as const : "O" as const,
          pView: [] as ArenaMove[],
          oView: [] as ArenaMove[],
          isTerminal: false,
          validity,
        };

        const pView = computePView(tempPosition);
        const oView = computeOView(tempPosition);

        return NextResponse.json({
          ok: true,
          validity,
          pView: pView.map((m) => ({
            address: m.address,
            player: m.player,
          })),
          oView: oView.map((m) => ({
            address: m.address,
            player: m.player,
          })),
        });
      }

      case "availableMoves": {
        // Get available moves from a position
        if (!sequence) {
          return NextResponse.json(
            { ok: false, error: "sequence is required for availableMoves action" },
            { status: 400 }
          );
        }

        // Convert sequence to ArenaMove[]
        const moves: ArenaMove[] = sequence.map((s: any, idx: number) => 
          createArenaMove(s.address, s.ramification || [], {
            id: s.id || `move-${idx}`,
            justifierId: s.justifierId,
          })
        );

        const validity = validatePosition(moves, arena);
        const currentPlayer = moves.length % 2 === 0 ? "P" as const : "O" as const;

        const position = {
          id: "temp",
          arenaId: arena.id,
          sequence: moves,
          length: moves.length,
          currentPlayer,
          pView: [] as ArenaMove[],
          oView: [] as ArenaMove[],
          isTerminal: false,
          validity,
        };

        const available = getAvailableMoves(position, arena);

        return NextResponse.json({
          ok: true,
          currentPlayer,
          isValid: validity.isValid,
          availableMoves: available.map((m) => ({
            id: m.id,
            address: m.address,
            player: m.player,
            ramification: m.ramification,
            isInitial: m.isInitial,
          })),
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Arena positions error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
