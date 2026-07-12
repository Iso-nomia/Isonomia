export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";

const QuerySchema = z.object({
  status: z
    .enum(["OPEN", "AWAITING_RESPONSE", "IN_REVISION", "CLOSED"])
    .optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
});

/**
 * List pathways targeting a given institution. Public pathways are visible
 * to anonymous callers (with actor IDs redacted); non-public pathways require
 * an authenticated session.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) return zodError(parsed.error);

  try {
    const institution = await prisma.institution.findUnique({
      where: { id: params.id },
      select: { id: true, slug: true, name: true, kind: true },
    });
    if (!institution) return apiError("NOT_FOUND", "Institution not found");

    const auth = await requireAuth();
    const isAuthed = auth.ok;

    const { status, limit, cursor } = parsed.data;

    const rows = await prisma.institutionalPathway.findMany({
      where: {
        institutionId: params.id,
        ...(status ? { status } : {}),
        ...(isAuthed ? {} : { isPublic: true }),
      },
      orderBy: { openedAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        deliberationId: true,
        institutionId: true,
        subject: true,
        status: true,
        isPublic: true,
        openedAt: true,
        closedAt: true,
        openedById: true,
        currentPacketId: true,
        currentPacket: {
          select: { id: true, version: true, status: true, title: true },
        },
        deliberation: { select: { id: true, title: true } },
      },
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((row) =>
      isAuthed ? row : { ...row, openedById: null },
    );
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return NextResponse.json({
      institution,
      items,
      nextCursor,
    });
  } catch (err) {
    return mapServiceError(err);
  }
}
