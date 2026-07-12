export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { createHash, createPrivateKey, sign as nodeSign } from "crypto";

const p = z.object({ id: z.union([z.string(), z.number(), z.bigint()]).transform(v => BigInt(v)) });

function canonicalize(x: any): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(canonicalize).join(",") + "]";
  const keys = Object.keys(x).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalize(x[k])).join(",") + "}";
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getUserFromCookies();
  if (!me?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: roomId } = p.parse(params);

  // Authorization: room admin only (adjust to your roles)
  const room = await prisma.room.findUnique({ where: { id: String(roomId) }, select: { id: true } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // TODO: verify me.userId is admin of room

  // Collect messages in room and their receipts
  const msgs = await prisma.message.findMany({
    where: { roomId: roomId } as any,
    select: { id: true },
  });
  const ids = msgs.map(m => m.id);
  const receipts = ids.length
    ? await prisma.mergeReceipt.findMany({
        where: { message_id: { in: ids } },
        orderBy: [{ message_id: "asc" }, { merged_at: "asc" }],
        select: {
          id: true, message_id: true, merged_by: true, merged_at: true,
          version_hash: true, signature: true
        }
      })
    : [];

  const payload = {
    schemaVersion: 1,
    roomId: String(roomId),
    exportedAt: new Date().toISOString(),
    receipts: receipts.map((r, idx) => ({
      id: r.id,
      messageId: String(r.message_id),
      // v is per-message; recompute quickly
      v: undefined as unknown as number,
      mergedBy: String(r.merged_by),
      mergedAt: r.merged_at,
      versionHash: r.version_hash,
      signature: r.signature,
    })),
  };

  // compute v per message
  const counts = new Map<string, number>();
  for (const rec of payload.receipts) {
    const key = rec.messageId;
    const c = (counts.get(key) || 0) + 1;
    counts.set(key, c);
    (rec as any).v = c;
  }

  const canon = canonicalize(payload);
  const sha256 = createHash("sha256").update(canon).digest("hex");

  let bundleSig: string | null = null;
  if (process.env.SOV_SIGNING_KEY_PEM) {
    const key = createPrivateKey(process.env.SOV_SIGNING_KEY_PEM!);
    bundleSig = nodeSign(null, Buffer.from(canon), key).toString("base64");
  }

  return NextResponse.json({
    manifest: payload,
    manifestHash: sha256,
    signature: bundleSig ? { alg: "ed25519-2020", signature: bundleSig } : null,
  });
}
