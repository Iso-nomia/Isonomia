export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/ratification-policy/route.ts
//
// Attack-ratification policy override (DEV_SPEC §3.3 / §12). API-only surface for
// v1 — the deliberation-creation/moderation UX exposes it properly in tier-2.
//
// GET  → the resolved policy (explicit override, else hostType-derived default).
// PUT  → write an explicit `attackRatificationPolicy` ("none" | "single" | "quorum:N").
//
// Mutability (D7): tightening NEVER demotes existing EFFECTIVE CAs. Loosening runs
// a one-shot sweep — any PROPOSED CA whose live sign-offs now meet the new (lower)
// threshold flips to EFFECTIVE. No scheduled job.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import {
  parseRatificationPolicy,
  ratificationThreshold,
  resolveRatificationPolicy,
} from "@/lib/aspic/ratification/policy";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const PolicyString = z.string().refine((s) => parseRatificationPolicy(s) !== null, {
  message: 'policy must be "none", "single", or "quorum:N" (N ≥ 1)',
});
const PutBody = z.object({ policy: PolicyString });

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const deliberationId = params.id;
  const pref = await prisma.deliberationPref.findUnique({
    where: { deliberationId },
    select: { attackRatificationPolicy: true },
  });
  const resolved = await resolveRatificationPolicy(deliberationId);
  return NextResponse.json(
    {
      ok: true,
      explicit: pref?.attackRatificationPolicy ?? null, // null → derived from hostType
      policy: resolved,
      threshold: ratificationThreshold(resolved),
    },
    NO_STORE,
  );
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await getCurrentUserId().catch(() => null);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });

  const parsed = PutBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });

  const deliberationId = params.id;
  const next = parseRatificationPolicy(parsed.data.policy)!; // refined above

  // DeliberationPref is created on-demand and `profile` has no default — supply
  // it on insert (mirrors the prefs route's "community" baseline).
  await prisma.deliberationPref.upsert({
    where: { deliberationId },
    update: { attackRatificationPolicy: parsed.data.policy },
    create: { deliberationId, profile: "community", attackRatificationPolicy: parsed.data.policy },
  });

  // Loosening sweep (D7): promote any PROPOSED CA that now clears the new threshold.
  // Tightening can only raise the threshold, so no existing EFFECTIVE CA is touched.
  const threshold = ratificationThreshold(next);
  let promoted = 0;
  const proposed = await prisma.conflictApplication.findMany({
    where: { deliberationId, ratificationStatus: "PROPOSED" },
    select: { id: true },
  });
  for (const ca of proposed) {
    const signoffs =
      threshold === 0
        ? 0
        : await prisma.conflictRatification.count({
            where: { conflictApplicationId: ca.id, withdrawnAt: null },
          });
    if (signoffs >= threshold) {
      await prisma.conflictApplication.update({
        where: { id: ca.id },
        data: { ratificationStatus: "EFFECTIVE", ratifiedAt: new Date() },
      });
      promoted++;
    }
  }

  return NextResponse.json(
    { ok: true, policy: next, threshold, promoted, scanned: proposed.length },
    NO_STORE,
  );
}
