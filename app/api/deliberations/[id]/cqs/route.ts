export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/cqs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import crypto from "node:crypto";
import { suggestionForCQ } from "@/lib/argumentation/cqSuggestions";
import { ArgCQArraySchema, ArgCQ } from "@/lib/types/argument";

type Params = { params: { id: string } };

/**
 * GET /api/deliberations/[id]/cqs
 * Returns all CQ data for all claims in a deliberation, organized by targetId.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const deliberationId = params.id;

  if (!deliberationId || deliberationId.length < 5) {
    return NextResponse.json(
      { error: "Invalid deliberationId" },
      { status: 400 }
    );
  }

  // Fetch all claims in this deliberation
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: { id: true },
  });

  const claimIds = claims.map((c) => c.id);

  if (claimIds.length === 0) {
    return NextResponse.json(
      { deliberationId, items: [] },
      {
        headers: {
          "Cache-Control": "private, max-age=30, must-revalidate",
        },
      }
    );
  }

  // Fetch scheme instances for all claims
  const instances = await prisma.schemeInstance.findMany({
    where: { targetType: "claim", targetId: { in: claimIds } },
    select: {
      targetId: true,
      scheme: { select: { key: true, title: true, cq: true } },
    },
  });

  // Fetch all CQ statuses for these claims
  const schemeKeys = [
    ...new Set(
      instances.map((i) => i.scheme?.key).filter(Boolean) as string[]
    ),
  ];

  const statuses = await prisma.cQStatus.findMany({
    where: {
      targetType: "claim",
      targetId: { in: claimIds },
      schemeKey: { in: schemeKeys },
    },
    select: { targetId: true, schemeKey: true, cqKey: true, satisfied: true },
  });

  // Build a map: targetId -> schemeKey -> cqKey -> satisfied
  const statusMap = new Map<string, Map<string, Map<string, boolean>>>();
  claimIds.forEach((cid) => statusMap.set(cid, new Map()));
  schemeKeys.forEach((sk) => {
    claimIds.forEach((cid) => {
      if (!statusMap.get(cid)!.has(sk)) {
        statusMap.get(cid)!.set(sk, new Map());
      }
    });
  });
  statuses.forEach((s) => {
    const claimMap = statusMap.get(s.targetId);
    if (claimMap) {
      const schemeMap = claimMap.get(s.schemeKey);
      if (schemeMap) {
        schemeMap.set(s.cqKey, s.satisfied);
      }
    }
  });

  // Build result array: one entry per claim with its CQs
  const items: Array<{
    targetId: string;
    schemes: Array<{
      key: string;
      title: string;
      cqs: Array<{
        key: string;
        text: string;
        satisfied: boolean;
        suggestion?: any;
      }>;
    }>;
  }> = [];

  for (const claimId of claimIds) {
    const claimInstances = instances.filter((i) => i.targetId === claimId);
    const schemes = claimInstances.map((i) => {
      const key = i.scheme?.key ?? "generic";
      const title = i.scheme?.title ?? key;

      // Validate cq JSON
      const parsedCqs = ArgCQArraySchema.safeParse(i.scheme?.cq ?? []);
      const cqs: ArgCQ[] = parsedCqs.success ? parsedCqs.data : [];

      const merged = cqs.map((cq) => ({
        key: cq.key,
        text: cq.text,
        satisfied: statusMap.get(claimId)?.get(key)?.get(cq.key) ?? false,
        suggestion: suggestionForCQ(key, cq.key),
      }));

      return { key, title, cqs: merged };
    });

    if (schemes.length > 0) {
      items.push({ targetId: claimId, schemes });
    }
  }

  // ETag handling
  const body = { deliberationId, items };
  const etag = crypto
    .createHash("sha1")
    .update(JSON.stringify(body))
    .digest("base64");

  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "private, max-age=30, must-revalidate",
      },
    });
  }

  return NextResponse.json(body, {
    headers: {
      ETag: etag,
      "Cache-Control": "private, max-age=30, must-revalidate",
    },
  });
}
