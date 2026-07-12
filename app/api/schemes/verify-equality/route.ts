/**
 * Spec 4 §3.3 — POST /api/schemes/verify-equality
 *
 * Body: { leftSchemeId: string; rightSchemeId: string; options?: VerifierOptions }
 * Returns: VerifierVerdict | { error: "scheme-not-found" | "bad-request" }
 *
 * Authentication: matches existing /api/schemes/* endpoints (no admin gate
 * enforced here; align with Spec 4 phase 4a v1 — admin gating becomes
 * mandatory when the non-redundancy panel ships in phase 4b).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { z } from "zod";
import {
  verifyBehaviourEquality,
  type SchemeWithCqs,
} from "@/lib/schemes/verifier";
import { verifySchemeEqualityByKey } from "@/lib/schemes/readTools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Body = z.object({
  leftSchemeId: z.string().min(1),
  rightSchemeId: z.string().min(1),
  options: z
    .object({
      searchBoundMs: z.number().int().positive().max(60_000).optional(),
      textNormalisation: z.enum(["exact", "case-trim", "fuzzy"]).optional(),
      cqKeyMatching: z.enum(["exact", "by-attack-type-and-scope"]).optional(),
    })
    .optional(),
});

async function loadSchemeWithCqs(id: string): Promise<SchemeWithCqs | null> {
  const row = await prisma.argumentScheme.findUnique({
    where: { id },
    include: { cqs: true },
  });
  return row as SchemeWithCqs | null;
}

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "bad-request", issues: parsed.error.issues }, { status: 400 });
  }

  const { leftSchemeId, rightSchemeId, options } = parsed.data;
  const [left, right] = await Promise.all([
    loadSchemeWithCqs(leftSchemeId),
    loadSchemeWithCqs(rightSchemeId),
  ]);
  if (!left || !right) {
    return NextResponse.json({ error: "scheme-not-found" }, { status: 404 });
  }

  const verdict = await verifyBehaviourEquality(left, right, options);
  return NextResponse.json(verdict, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Roadmap C.1 — GET /api/schemes/verify-equality?keyA=&keyB=&searchBoundMs=
 *
 * Key-addressed read surface that backs the MCP `verify_scheme_equality` tool.
 * Returns the enriched shape { verdict, witnessOrCounter, runtimeMs,
 * fingerprintsMatched, note } with the necessary-but-not-sufficient framing.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const keyA = url.searchParams.get("keyA");
  const keyB = url.searchParams.get("keyB");
  if (!keyA || !keyB) {
    return NextResponse.json(
      { error: "bad-request", detail: "keyA and keyB query params are required" },
      { status: 400 },
    );
  }
  const searchBoundRaw = url.searchParams.get("searchBoundMs");
  const searchBoundMs = searchBoundRaw ? Number(searchBoundRaw) : undefined;
  if (
    searchBoundMs !== undefined &&
    (!Number.isFinite(searchBoundMs) || searchBoundMs <= 0 || searchBoundMs > 60_000)
  ) {
    return NextResponse.json(
      { error: "bad-request", detail: "searchBoundMs must be 1..60000" },
      { status: 400 },
    );
  }

  const result = await verifySchemeEqualityByKey(
    keyA,
    keyB,
    searchBoundMs ? { searchBoundMs } : undefined,
  );
  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
