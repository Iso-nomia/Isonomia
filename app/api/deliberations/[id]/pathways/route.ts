export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";
import { OpenPathwaySchema } from "@/lib/pathways/schemas";
import { openPathway } from "@/lib/pathways/pathwayService";
import { isFacilitator } from "@/lib/pathways/auth";
import { apiError } from "@/lib/pathways/apiHelpers";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!(await isFacilitator(params.id, auth.userId))) {
    return apiError("FORBIDDEN", "Facilitator role required to open a pathway");
  }

  const parsed = OpenPathwaySchema.safeParse(await parseJson(req));
  if (!parsed.success) return zodError(parsed.error);

  try {
    const pathway = await openPathway({
      deliberationId: params.id,
      institutionId: parsed.data.institutionId,
      subject: parsed.data.subject,
      isPublic: parsed.data.isPublic,
      openedById: auth.userId,
    });
    return NextResponse.json({ pathway }, { status: 201 });
  } catch (err) {
    return mapServiceError(err);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const pathways = await prisma.institutionalPathway.findMany({
    where: { deliberationId: params.id },
    orderBy: { openedAt: "desc" },
    include: {
      institution: { select: { id: true, name: true, kind: true } },
      currentPacket: { select: { version: true } },
    },
  });

  const items = pathways.map((p) => ({
    id: p.id,
    institution: p.institution,
    subject: p.subject,
    status: p.status,
    currentPacketVersion: p.currentPacket?.version ?? null,
    openedAt: p.openedAt,
    isPublic: p.isPublic,
  }));

  return NextResponse.json({ items });
}
