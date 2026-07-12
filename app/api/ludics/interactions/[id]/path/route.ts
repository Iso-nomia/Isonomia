export const dynamic = "force-dynamic";

/**
 * DDS Interaction Path Extraction API Route
 * 
 * GET /api/ludics/interactions/[id]/path - Extract narrative from interaction
 * POST /api/ludics/interactions/[id]/path - Extract with options (placeholder)
 * 
 * Generates justified narratives directly from interaction move history.
 */

import { NextRequest, NextResponse } from "next/server";
import { interactionStore } from "../../store";
import { isGameOver, getGameWinner } from "@/packages/ludics-core/dds/game";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ludics/interactions/[id]/path
 * Extract paths from completed or in-progress interaction
 * 
 * Query params:
 * - format: "json" | "markdown" | "html" | "plaintext" (default: "json")
 * - includeIncarnation: "true" | "false" (default: "false")
 * - includeAllPaths: "true" | "false" (default: "false")
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Interaction ID is required" },
        { status: 400 }
      );
    }

    const interaction = interactionStore.get(id);
    if (!interaction) {
      return NextResponse.json(
        { ok: false, error: "Interaction not found" },
        { status: 404 }
      );
    }

    // Generate narrative directly from interaction move history
    // This is more robust than using the extraction module which has type mismatches
    const moves = interaction.moveHistory || [];
    const gameOver = isGameOver(interaction.gameState);
    const winner = gameOver ? getGameWinner(interaction.gameState) : null;

    const narrative = {
      id: `narrative-${id}`,
      title: "Game Proof Narrative",
      steps: moves.map((move: any, idx: number) => ({
        stepNumber: idx + 1,
        speaker: move.player === "P" ? "Proponent" : "Opponent",
        moveType: idx === 0 ? "opening" : (idx === moves.length - 1 && gameOver ? "closing" : "response"),
        content: idx === 0 
          ? "Opening move - establishing initial position"
          : `Response to ${moves[idx - 1]?.player === "P" ? "Proponent" : "Opponent"}'s move`,
        address: typeof move.address === "string" 
          ? move.address.split("").map(Number) 
          : (move.address || []),
        justificationChain: Array.from({ length: idx }, (_, i) => i + 1),
        polarity: move.player === "P" ? "+" as const : "-" as const,
        isDaimon: false,
        timestamp: move.timestamp || new Date().toISOString(),
      })),
      conclusion: {
        winner: winner === "P" ? "P" : winner === "O" ? "O" : "draw",
        summary: `Game completed in ${moves.length} moves. ${winner ? `Player ${winner} wins.` : "Game ended in draw."}`,
        keyPoints: [
          `Total moves: ${moves.length}`,
          `Proponent (P) moves: ${moves.filter((m: any) => m.player === "P").length}`,
          `Opponent (O) moves: ${moves.filter((m: any) => m.player === "O").length}`,
        ],
      },
      metadata: {
        interactionId: id,
        arenaId: interaction.arenaId,
        generatedAt: new Date().toISOString(),
        style: "formal" as const,
      },
    };

    // Format output based on request
    let formattedContent = "";
    if (format === "markdown") {
      formattedContent = `# ${narrative.title}\n\n` +
        narrative.steps.map(s => `## Step ${s.stepNumber}: ${s.speaker}\n${s.content}\n`).join("\n") +
        `\n## Conclusion\n${narrative.conclusion.summary}`;
    } else if (format === "plaintext") {
      formattedContent = `${narrative.title}\n\n` +
        narrative.steps.map(s => `${s.stepNumber}. ${s.speaker}: ${s.content}`).join("\n") +
        `\n\nConclusion: ${narrative.conclusion.summary}`;
    } else if (format === "html") {
      formattedContent = `<h1>${narrative.title}</h1>` +
        narrative.steps.map(s => `<div><h3>Step ${s.stepNumber}: ${s.speaker}</h3><p>${s.content}</p></div>`).join("") +
        `<h2>Conclusion</h2><p>${narrative.conclusion.summary}</p>`;
    }

    return NextResponse.json({
      ok: true,
      interactionId: id,
      narrative,
      formatted: format !== "json" ? { format, content: formattedContent } : undefined,
      stats: {
        totalMoves: moves.length,
        pMoves: moves.filter((m: any) => m.player === "P").length,
        oMoves: moves.filter((m: any) => m.player === "O").length,
        maxDepth: Math.max(...moves.map((m: any) => {
          const addr = typeof m.address === "string" ? m.address : (m.address?.join("") || "");
          return addr.length;
        }), 0),
        gameOver,
        winner,
      },
    });
  } catch (error: any) {
    console.error("[Path Extraction GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}


/**
 * POST /api/ludics/interactions/[id]/path
 * Extract paths with detailed options (simplified version)
 * 
 * Body:
 * - format?: "json" | "markdown" | "html" | "plaintext"
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { format = "json" } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Interaction ID is required" },
        { status: 400 }
      );
    }

    const interaction = interactionStore.get(id);
    if (!interaction) {
      return NextResponse.json(
        { ok: false, error: "Interaction not found" },
        { status: 404 }
      );
    }

    // Generate narrative directly from interaction move history
    const moves = interaction.moveHistory || [];
    const gameOver = isGameOver(interaction.gameState);
    const winner = gameOver ? getGameWinner(interaction.gameState) : null;

    const narrative = {
      id: `narrative-${id}`,
      title: "Game Proof Narrative",
      steps: moves.map((move: any, idx: number) => ({
        stepNumber: idx + 1,
        speaker: move.player === "P" ? "Proponent" : "Opponent",
        moveType: idx === 0 ? "opening" : (idx === moves.length - 1 && gameOver ? "closing" : "response"),
        content: idx === 0 
          ? "Opening move - establishing initial position"
          : `Response to ${moves[idx - 1]?.player === "P" ? "Proponent" : "Opponent"}'s move`,
        address: typeof move.address === "string" 
          ? move.address.split("").map(Number) 
          : (move.address || []),
        justificationChain: Array.from({ length: idx }, (_, i) => i + 1),
        polarity: move.player === "P" ? "+" as const : "-" as const,
        isDaimon: false,
        timestamp: move.timestamp || new Date().toISOString(),
      })),
      conclusion: {
        winner: winner === "P" ? "P" : winner === "O" ? "O" : "draw",
        summary: `Game completed in ${moves.length} moves. ${winner ? `Player ${winner} wins.` : "Game ended in draw."}`,
        keyPoints: [
          `Total moves: ${moves.length}`,
          `Proponent (P) moves: ${moves.filter((m: any) => m.player === "P").length}`,
          `Opponent (O) moves: ${moves.filter((m: any) => m.player === "O").length}`,
        ],
      },
      metadata: {
        interactionId: id,
        arenaId: interaction.arenaId,
        generatedAt: new Date().toISOString(),
        style: "formal" as const,
      },
    };

    // Format output based on request
    let formattedContent = "";
    if (format === "markdown") {
      formattedContent = `# ${narrative.title}\n\n` +
        narrative.steps.map(s => `## Step ${s.stepNumber}: ${s.speaker}\n${s.content}\n`).join("\n") +
        `\n## Conclusion\n${narrative.conclusion.summary}`;
    } else if (format === "plaintext") {
      formattedContent = `${narrative.title}\n\n` +
        narrative.steps.map(s => `${s.stepNumber}. ${s.speaker}: ${s.content}`).join("\n") +
        `\n\nConclusion: ${narrative.conclusion.summary}`;
    } else if (format === "html") {
      formattedContent = `<h1>${narrative.title}</h1>` +
        narrative.steps.map(s => `<div><h3>Step ${s.stepNumber}: ${s.speaker}</h3><p>${s.content}</p></div>`).join("") +
        `<h2>Conclusion</h2><p>${narrative.conclusion.summary}</p>`;
    }

    return NextResponse.json({
      ok: true,
      interactionId: id,
      narrative,
      formatted: format !== "json" ? { format, content: formattedContent } : undefined,
      stats: {
        totalMoves: moves.length,
        pMoves: moves.filter((m: any) => m.player === "P").length,
        oMoves: moves.filter((m: any) => m.player === "O").length,
        gameOver,
        winner,
      },
    });
  } catch (error: any) {
    console.error("[Path Extraction POST Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
