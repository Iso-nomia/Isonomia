export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(req: NextRequest) {
  const deliberationId = req.nextUrl.searchParams.get("deliberationId") || "";
  if (!deliberationId) return NextResponse.json({ ok:false, error:"missing deliberationId" }, { status:400 });

  // Support filtering by scope or scopeType
  const scopeFilter = req.nextUrl.searchParams.get("scope");
  const scopeTypeFilter = req.nextUrl.searchParams.get("scopeType");

  const where: any = { deliberationId };
  
  // Allow filtering for specific scope (including null for legacy)
  if (scopeFilter !== null) {
    where.scope = scopeFilter === "null" ? null : scopeFilter;
  }
  
  // Allow filtering by scopeType
  if (scopeTypeFilter) {
    where.scopeType = scopeTypeFilter;
  }

  const designs = await prisma.ludicDesign.findMany({
    where,
    orderBy: [
      { scope: "asc" },
      { participantId: "asc" },
    ],
    include: {
      acts: { include: { locus: true }, orderBy: { orderInDesign: "asc" } },
    },
  });

  // Group designs by scope for forest view
  const grouped: Record<string, typeof designs> = {};
  const scopes: string[] = [];
  
  for (const design of designs) {
    const scopeKey = design.scope ?? "legacy";
    if (!grouped[scopeKey]) {
      grouped[scopeKey] = [];
      scopes.push(scopeKey);
    }
    grouped[scopeKey].push(design);
  }

  // Extract unique scope metadata for UI
  const scopeMetadata: Record<string, any> = {};
  for (const design of designs) {
    const scopeKey = design.scope ?? "legacy";
    if (!scopeMetadata[scopeKey] && design.scopeMetadata) {
      scopeMetadata[scopeKey] = design.scopeMetadata;
    }
  }

  return NextResponse.json({ 
    ok: true, 
    designs,
    grouped,
    scopes,
    scopeMetadata,
  });
}
