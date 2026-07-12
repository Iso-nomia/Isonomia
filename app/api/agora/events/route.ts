import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import {
  filterVisibleDeliberationIds,
  normalizeUserId,
} from "@/lib/deliberations/visibility";

export const dynamic = "force-dynamic";

type FeedEvent = { id: string; ts: number; type: string; [k: string]: any };
const RING = (globalThis as any).__agoraRing__ ??= { buf: [] as FeedEvent[], cap: 2048 };

/**
 * Drop events tied to a deliberation the viewer may not see. Events with no
 * `deliberationId` (e.g. bare citations) pass through. One visibility query for
 * the whole batch. See lib/deliberations/visibility.ts.
 */
async function gateByVisibility(
  items: FeedEvent[],
  userId: string | null,
): Promise<FeedEvent[]> {
  const visible = await filterVisibleDeliberationIds(
    items.map((e) => e.deliberationId),
    userId,
  );
  return items.filter((e) => !e.deliberationId || visible.has(e.deliberationId));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const since = Number(url.searchParams.get('since') || 0);
  const rawLimit = Number(url.searchParams.get('limit') || 50);
  const limit = Number.isFinite(rawLimit) ? Math.max(0, Math.min(200, rawLimit)) : 50;

  const userId = normalizeUserId(await getCurrentUserId().catch(() => null));

  const ringItems = since
    ? RING.buf.filter((e: FeedEvent) => Number.isFinite(e.ts) && e.ts > since).slice(-limit)
    : RING.buf.slice(-limit);

  // Fast path: ring has useful items or client asked for limit=0 probe
  if (ringItems.length || limit === 0) {
    return NextResponse.json({ ok: true, items: await gateByVisibility(ringItems, userId) });
  }

  // Cold start bootstrap from DB (best-effort, condensed)
  const takeMoves = Math.ceil(limit * 0.6);
  const takeCites = Math.ceil(limit * 0.3);
  const takeRecs  = Math.ceil(limit * 0.3);

  const [moves, cites, receipts] = await Promise.all([
    prisma.dialogueMove.findMany({
      orderBy: { createdAt: "desc" }, take: takeMoves,
      select: { id:true, deliberationId:true, targetType:true, targetId:true, kind:true, createdAt:true },
    }),
    prisma.citation.findMany({
      orderBy: { createdAt: "desc" }, take: takeCites, include: { source: true },
    }),
    ((prisma as any).ludicDecisionReceipt?.findMany?.({
      orderBy: { createdAt: "desc" }, take: takeRecs,
      select: { id:true, deliberationId:true, kind:true, subjectType:true, subjectId:true, createdAt:true, rationale:true },
    }).catch(()=>[]) ?? []),
  ]);

  const moveEvents: FeedEvent[] = moves.map((m) => ({
    id: `mv:${m.id}`, type: "dialogue:changed",
    ts: new Date(m.createdAt).getTime(),
    title: `New move${m.kind ? ` (${m.kind})` : ""}`,
    deliberationId: m.deliberationId, targetType: m.targetType, targetId: m.targetId, icon: "move",
  }));

  const citeEvents: FeedEvent[] = cites.map((c:any) => ({
    id: `ct:${c.id}`, type: "citations:changed",
    ts: new Date(c.createdAt).getTime(),
    title: `Added source`, targetType: c.targetType, targetId: c.targetId,
    link: c?.source?.url ?? undefined, icon: "link",
  }));

  const decisionEvents: FeedEvent[] = (receipts as any[]).map((r) => ({
    id: `dc:${r.id}`, type: "decision:changed",
    ts: new Date(r.createdAt).getTime(),
    title: `Decision (${r.kind})`,
    deliberationId: r.deliberationId, icon: "check",
  }));

  const items = [...moveEvents, ...citeEvents, ...decisionEvents]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);

  return NextResponse.json({ ok: true, items: await gateByVisibility(items, userId) });
}
