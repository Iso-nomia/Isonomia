/**
 * GET /api/v3/deliberations/[id]/synthetic-readout
 *
 * Track AI-EPI Pt. 4 §5 — SyntheticReadout endpoint.
 *
 * The editorial primitive. Composes fingerprint + frontier + missing
 * moves + chain exposure into a single deliberation-scope object whose
 * shape makes centrist-synthesis prose structurally hard to construct.
 * The `refusalSurface.cannotConcludeBecause` field enumerates exactly
 * what the graph will not license; consumers that close anyway lie
 * about a structured field.
 */
import { NextRequest, NextResponse } from "next/server";
import { computeSyntheticReadout, type SyntheticReadout } from "@/lib/deliberation/syntheticReadout";

export const dynamic = "force-dynamic";

/**
 * Post-process a readout into a token-efficient shape for MCP / LLM
 * consumers. Strips redundant fields that can be reconstructed from
 * what remains, drops free-text prompt strings whose canonical
 * identifier (schemeKey + cqKey) is already present, and caps long
 * tail lists. Reduces the polarization-1 payload from ~220KB → ~45KB.
 *
 * Compact transformations:
 *   - frontier.unansweredCqs[i].cqPrompt  → dropped (keep schemeKey + cqKey)
 *   - frontier.unansweredCqs               → capped at top 30 (already sorted)
 *   - frontier.loadBearingnessRanking      → dropped (use topArguments[].id)
 *   - frontier.terminalLeaves              → capped at 10 (rarely consumed)
 *   - missingMoves.perArgument             → entries with no missingCqs and
 *                                            no missingUndercutTypes dropped;
 *                                            present/expected arrays stripped
 */
function toCompactReadout(readout: SyntheticReadout): SyntheticReadout {
  const compactFrontier = {
    ...readout.frontier,
    unansweredCqs: readout.frontier.unansweredCqs
      .slice(0, 30)
      .map((c) => ({
        targetArgumentId: c.targetArgumentId,
        schemeKey: c.schemeKey,
        cqKey: c.cqKey,
        severity: c.severity,
      })) as SyntheticReadout["frontier"]["unansweredCqs"],
    terminalLeaves: readout.frontier.terminalLeaves.slice(0, 10),
    loadBearingnessRanking: [] as string[],
    loadBearingnessScores: {} as Record<string, number>,
  };

  const perArg = readout.missingMoves.perArgument as Record<string, unknown>;
  const compactPerArgument: Record<string, unknown> = {};
  for (const [argId, raw] of Object.entries(perArg)) {
    const entry = raw as {
      schemeKey: string;
      argumentId: string;
      missingCqs: string[];
      missingUndercutTypes: string[];
    };
    // Drop entries with nothing missing — they're noise for synthesis.
    if (
      entry.missingCqs.length === 0 &&
      entry.missingUndercutTypes.length === 0
    ) {
      continue;
    }
    compactPerArgument[argId] = {
      schemeKey: entry.schemeKey,
      argumentId: entry.argumentId,
      missingCqs: entry.missingCqs,
      missingUndercutTypes: entry.missingUndercutTypes,
    };
  }

  return {
    ...readout,
    frontier: compactFrontier,
    missingMoves: {
      ...readout.missingMoves,
      perArgument: compactPerArgument as SyntheticReadout["missingMoves"]["perArgument"],
    },
  };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const view = req.nextUrl.searchParams.get("view");
  const compact = view === "compact";
  try {
    const readout = await computeSyntheticReadout(id);
    if (!readout) {
      return NextResponse.json(
        { error: "deliberation not found" },
        { status: 404 },
      );
    }
    const payload = compact ? toCompactReadout(readout) : readout;
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60",
        "X-Content-Hash": readout.contentHash,
        "X-View": compact ? "compact" : "full",
      },
    });
  } catch (err: any) {
    // Transient DB connectivity (Supabase pooler hiccup, etc.) returns
    // Prisma P1001. Surface as 503 so SWR backs off rather than
    // treating it as a permanent failure.
    if (err?.code === "P1001" || err?.code === "P1002" || err?.code === "P1017") {
      return NextResponse.json(
        { error: "upstream unavailable", code: err.code },
        { status: 503, headers: { "Retry-After": "5" } },
      );
    }
    throw err;
  }
}
