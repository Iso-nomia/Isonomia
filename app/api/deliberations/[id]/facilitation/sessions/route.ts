export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/facilitation/apiHelpers";
import { OpenSessionSchema } from "@/lib/facilitation/schemas";
import { openSession } from "@/lib/facilitation/sessionService";
import { canManageFacilitation } from "@/lib/facilitation/auth";
import { FacilitationSessionStatus } from "@/lib/facilitation/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = OpenSessionSchema.safeParse((await parseJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  if (!(await canManageFacilitation(auth.userId, params.id))) {
    return apiError("FORBIDDEN", "Facilitator role required to open a session");
  }

  try {
    const session = await openSession({
      deliberationId: params.id,
      openedById: auth.userId,
      isPublic: parsed.data.isPublic,
      summary: parsed.data.summary ?? null,
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    return mapServiceError(err);
  }
}

/**
 * GET — cockpit context. Returns the deliberation's currently OPEN session
 * (if any) and the most recent question (locked or draft) with checks. Used
 * by the FacilitationCockpit page to bootstrap state in a single call.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  // Read access: any deliberation role (mirrors metrics route).
  const role = await prisma.deliberationRole.findFirst({
    where: { deliberationId: params.id, userId: auth.userId },
    select: { id: true },
  });
  const isManager = await canManageFacilitation(auth.userId, params.id);
  if (!role && !isManager) {
    return apiError("FORBIDDEN", "Deliberation role required");
  }

  const session = await prisma.facilitationSession.findFirst({
    where: { deliberationId: params.id, status: FacilitationSessionStatus.OPEN },
    orderBy: { openedAt: "desc" },
  });

  const question = await prisma.facilitationQuestion.findFirst({
    where: { deliberationId: params.id },
    orderBy: [{ version: "desc" }],
    include: { checks: { orderBy: { createdAt: "desc" } } },
  });

  let parentText: string | null = null;
  if (question?.parentQuestionId) {
    const parent = await prisma.facilitationQuestion.findUnique({
      where: { id: question.parentQuestionId },
      select: { text: true },
    });
    parentText = parent?.text ?? null;
  }

  return NextResponse.json({
    session,
    question,
    parentText,
    canManage: isManager,
  });
}
