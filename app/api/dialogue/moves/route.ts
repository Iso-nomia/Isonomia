// app/api/dialogue/moves/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";

const Q = z.object({
  deliberationId: z.string().min(5),
  // Optional filters
  targetType: z.enum(["argument", "claim", "card"]).optional(),
  targetId: z.string().min(3).optional(),
  kinds: z
    .string()
    .optional() // comma-separated list
    .transform((s) =>
      (s ?? "")
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean)
    )
    .pipe(
      z
        .enum(["ASSERT", "WHY", "GROUNDS", "RETRACT", "CONCEDE", "CLOSE"])
        .array()
        .optional()
    ),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
  limit: z
    .string()
    .optional()
    .transform((s) => (s ? Number(s) : undefined))
    .pipe(z.number().int().min(1).max(500).optional().default(200)),
  since: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      // accept ms epoch or ISO
      const n = Number(s);
      if (!Number.isNaN(n)) return new Date(n);
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }),
  cursorId: z.string().optional(), // optional stable pagination
});

export async function GET(req: NextRequest) {
  const parsed = Q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    deliberationId,
    targetType,
    targetId,
    kinds,
    order,
    limit,
    since,
    cursorId,
  } = parsed.data;

  const where: any = {
    deliberationId,
    ...(targetType ? { targetType } : {}),
    ...(targetId ? { targetId } : {}),
    ...(kinds && kinds.length ? { kind: { in: kinds } } : {}),
    ...(since ? { createdAt: { gt: since } } : {}),
  };

  // Basic cursor support (id only, consistent with order by createdAt then id)
   const take = (limit ?? 200);
  const rows = await prisma.dialogueMove.findMany({
    where,
    orderBy: [{ createdAt: order }, { id: order }],
    take: take + 1,                      // always overfetch by 1
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    select: {
      id: true,
      deliberationId: true,
      targetType: true,
      targetId: true,
      kind: true,
      payload: true,
      actorId: true,
      createdAt: true,
    },
  });

  // Prepare next cursor (use last row id when we hit the limit)
  const items = rows.slice(0, take);
  const nextCursor = rows.length > take ? items[items.length - 1]?.id : null;
  return NextResponse.json(
    {
      ok: true,
      items,
      nextCursor,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
