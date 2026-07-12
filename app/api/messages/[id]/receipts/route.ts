import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";

export const runtime = "nodejs";

const qp = z.object({
  latest: z
    .union([z.string(), z.number(), z.boolean()])
    .optional()
    .transform((v) => {
      if (v === undefined) return false;
      if (typeof v === "boolean") return v;
      const s = String(v).toLowerCase();
      return s === "1" || s === "true" || s === "yes";
    }),
});

function toJsonReceipt(r: any, v: number) {
  // Convert BigInt fields so JSON.stringify won't explode
  return {
    id: r.id?.toString?.() ?? r.id,
    message_id: r.message_id?.toString?.() ?? r.message_id,
    v,
    version_hash: r.version_hash,
    parents: r.parents ?? [],
    from_facet_ids: r.from_facet_ids ?? [],
    merged_by: r.merged_by?.toString?.() ?? r.merged_by,
    merged_at: r.merged_at, // Date is fine (serializes as ISO)
    policy_id: r.policy_id ?? "owner-or-mod@v1",
    approvals: r.approvals ?? [],
    blocks: r.blocks ?? [],
    summary: r.summary ?? null,
    prev_receipt_hash: r.prev_receipt_hash ?? null,
    signature: r.signature ?? null,
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const messageId = BigInt(params.id);
  const { latest } = qp.parse(Object.fromEntries(new URL(req.url).searchParams));

  if (latest) {
    // Compute latest by merged_at desc; compute v as count (ordinal)
    const total = await prisma.mergeReceipt.count({ where: { message_id: messageId } });
    if (total === 0) return NextResponse.json({ ok: true, items: [] });

    const row = await prisma.mergeReceipt.findFirst({
      where: { message_id: messageId },
      orderBy: [{ merged_at: "desc" }, { id: "desc" }], // tie-breaker by id
    });

    return NextResponse.json({
      ok: true,
      items: row ? [toJsonReceipt(row, total)] : [],
    });
  }

  // Full history: oldest → newest so v = index+1
  const rows = await prisma.mergeReceipt.findMany({
    where: { message_id: messageId },
    orderBy: [{ merged_at: "asc" }, { id: "asc" }],
  });

  const items = rows.map((r, i) => toJsonReceipt(r, i + 1));

  return NextResponse.json({ ok: true, items });
}
