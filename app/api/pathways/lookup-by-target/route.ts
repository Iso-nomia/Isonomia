export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { apiError, zodError } from "@/lib/pathways/apiHelpers";
import { getCurrentUserId } from "@/lib/serverutils";

/**
 * A3.6 — lookup which submitted packets reference a given target
 * (claim / argument / card / note) so claim/argument cards can render an
 * inline "forwarded to <institution> in packet vN" badge.
 *
 * Only items in packets that have ever been submitted are returned; pure
 * drafts are intentionally hidden to avoid leaking in-progress facilitator
 * work.
 *
 * Anon callers see only items belonging to `isPublic = true` pathways;
 * authenticated callers additionally see items for pathways in deliberations
 * they participate in (membership check kept light — full membership scoping
 * lives in `loadPathwayContext`; here we err on the side of public-read
 * since the badge is non-confidential by design).
 */

const QuerySchema = z.object({
  targetType: z.enum(["claim", "argument", "card", "note"]),
  targetId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  const isAuthed = !!userId;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) return zodError(parsed.error);

  const { targetType, targetId, limit } = parsed.data;

  try {
    const items = await prisma.recommendationPacketItem.findMany({
      where: {
        targetType,
        targetId,
        packet: {
          // Only surface items in packets that have been submitted (or sent
          // to revision). Hides pure drafts.
          status: { in: ["SUBMITTED", "ACKNOWLEDGED", "RESPONDED", "REVISED"] as any },
          ...(isAuthed ? {} : { pathway: { isPublic: true } }),
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        packet: {
          select: {
            id: true,
            version: true,
            pathway: {
              select: {
                id: true,
                status: true,
                isPublic: true,
                institution: { select: { id: true, name: true, kind: true } },
              },
            },
          },
        },
      },
    });

    // De-duplicate by pathwayId — a packet item may belong to a packet whose
    // pathway has multiple historical packets containing the same target;
    // we want one chip per pathway.
    const byPathway = new Map<
      string,
      {
        pathwayId: string;
        pathwayStatus: string;
        packetVersion: number;
        institution: { id: string; name: string; kind: string };
      }
    >();
    for (const it of items) {
      const pw = it.packet?.pathway;
      if (!pw) continue;
      if (!isAuthed && !pw.isPublic) continue;
      const cur = byPathway.get(pw.id);
      if (!cur || it.packet.version > cur.packetVersion) {
        byPathway.set(pw.id, {
          pathwayId: pw.id,
          pathwayStatus: pw.status,
          packetVersion: it.packet.version,
          institution: pw.institution,
        });
      }
    }

    return NextResponse.json({ items: Array.from(byPathway.values()) });
  } catch (err) {
    return apiError("INTERNAL", (err as Error).message);
  }
}
