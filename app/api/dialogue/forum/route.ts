export const dynamic = "force-dynamic";

// app/api/dialogue/forum/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

type Node = {
  id: string;
  kind: "ASSERT" | "WHY" | "GROUNDS";
  text: string;
  locusId: string | null;
  targetType: string;
  targetId: string;
  authorId: string;
  createdAt: string;
  replies: Node[];
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deliberationId = url.searchParams.get("deliberationId") || "";
  if (!deliberationId) return NextResponse.json({ error: "deliberationId required" }, { status: 400 });

  const moves = await prisma.dialogueMove.findMany({
    where: { deliberationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, kind: true, targetType: true, targetId: true, payload: true, actorId: true, createdAt: true, locusId: true },
  });

  // Simple threader:
  // - ASSERT = root
  // - WHY/GROUNDS reply to nearest prior ASSERT with same locusId
  const nodes: Record<string, Node> = {};
  const roots: Node[] = [];

  function textOf(p: any) {
    return String(p?.text ?? p?.brief ?? p?.note ?? "").trim();
  }

  for (const m of moves) {
    if (!["ASSERT", "WHY", "GROUNDS"].includes(m.kind)) continue;
    const n: Node = {
      id: m.id,
      kind: m.kind as any,
      text: textOf(m.payload),
      locusId: m.locusId,
      targetType: m.targetType,
      targetId: m.targetId,
      authorId: m.actorId,
      createdAt: m.createdAt.toISOString(),
      replies: [],
    };
    nodes[n.id] = n;

    if (n.kind === "ASSERT") {
      roots.push(n);
    } else {
      // find last ASSERT with same locusId; fallback: last ASSERT overall
           const parent =
     [...roots].reverse().find((r) => r.locusId && r.locusId === n.locusId)
     ?? [...roots].reverse().find((r) => (r as any).payload?.locusPath === (n as any).payload?.locusPath)
     ?? roots[roots.length - 1];
        // 1) explicit reply
        const rm = moves.find(x => String(x.id) === String((m as any).replyToMoveId));
      //   if (rm && nodes[rm.id]) parent = nodes[rm.id];
      //   // 2) fallback: nearest ASSERT at same locus
       // if (!parent) parent = [...roots].reverse().find(r => r.locusId && r.locusId === n.locusId) ?? roots[roots.length - 1];
      // (parent?.replies ?? roots).push && parent ? parent.replies.push(n) : roots.push(n);
    }
  }

  return NextResponse.json({ roots });
}
