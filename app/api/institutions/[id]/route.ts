export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { apiError, mapServiceError, requireAuth } from "@/lib/pathways/apiHelpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const institution = await prisma.institution.findUnique({
      where: { id: params.id },
      include: { members: true },
    });
    if (!institution) return apiError("NOT_FOUND", "Institution not found");

    const activePathwayCount = await prisma.institutionalPathway.count({
      where: {
        institutionId: params.id,
        status: { not: "CLOSED" },
      },
    });

    const { members, ...rest } = institution;

    return NextResponse.json({
      institution: rest,
      members,
      activePathwayCount,
      responseLatency: {
        medianAcknowledgementMs: null,
        medianResponseMs: null,
      },
    });
  } catch (err) {
    return mapServiceError(err);
  }
}
