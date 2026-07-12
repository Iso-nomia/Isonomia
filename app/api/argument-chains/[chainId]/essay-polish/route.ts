/**
 * app/api/argument-chains/[chainId]/essay-polish/route.ts
 *
 * M6 — POST endpoint that runs the LLM polish pass on an essay already
 * generated client-side by `generateEssay`. The client owns the
 * deterministic prose (single source of truth); the server only:
 *   1. Validates the chain exists and grabs `chain.purpose` +
 *      `deliberationId` for the prompt / flag-override lookup.
 *   2. Calls `polishEssay` (which handles the flag, cache, LLM call,
 *      and fact-preservation guard).
 *   3. Returns the polished text plus observability fields.
 *
 * Request body:
 *   {
 *     contentHash: string,
 *     deterministicProse: string,
 *     tone: "academic" | "journalistic" | "deliberative" | "persuasive",
 *     audience: "general" | "informed" | "expert",
 *     standingsSummary: {
 *       oneLiner: string,
 *       survivingCount: number,
 *       fallenCount: number,
 *       residualCount: number,
 *       refusalBanner?: string,
 *     },
 *     modelId?: string,
 *   }
 *
 * Response body: `PolishResult` (see `lib/chains/essayPolish.ts`).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { polishEssay } from "@/lib/chains/essayPolish";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string }> },
) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { chainId } = await params;

  const {
    contentHash,
    deterministicProse,
    tone,
    audience,
    standingsSummary,
    modelId,
    force,
  } = body ?? {};

  if (
    typeof contentHash !== "string" ||
    typeof deterministicProse !== "string" ||
    !deterministicProse.trim() ||
    typeof tone !== "string" ||
    typeof audience !== "string" ||
    !standingsSummary ||
    typeof standingsSummary.oneLiner !== "string"
  ) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Validate the chain exists and read the prompt-feeder fields.
  const chain = await prisma.argumentChain.findUnique({
    where: { id: chainId },
    select: { id: true, purpose: true, deliberationId: true },
  });
  if (!chain) {
    return NextResponse.json({ error: "chain_not_found" }, { status: 404 });
  }

  const result = await polishEssay({
    chainId: chain.id,
    contentHash,
    chainPurpose: chain.purpose ?? null,
    deterministicProse,
    tone: tone as any,
    audience: audience as any,
    standingsSummary: {
      oneLiner: String(standingsSummary.oneLiner),
      survivingCount: Number(standingsSummary.survivingCount) || 0,
      fallenCount: Number(standingsSummary.fallenCount) || 0,
      residualCount: Number(standingsSummary.residualCount) || 0,
      refusalBanner:
        typeof standingsSummary.refusalBanner === "string"
          ? standingsSummary.refusalBanner
          : undefined,
    },
    modelId: typeof modelId === "string" ? modelId : undefined,
    deliberationId: chain.deliberationId ?? null,
    force: force === true,
  });

  return NextResponse.json(result);
}
