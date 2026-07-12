import { Hooks } from '../hooks';
import { prisma } from '@/lib/prismaclient';

// expect a project-local adapter; guard if missing
type NliRel = 'entails' | 'contradicts' | 'neutral';
type NliPair = { premise: string; hypothesis: string };
type NliResult = { relation: NliRel; score: number };

declare function getNLIAdapter(): { batch: (pairs: NliPair[]) => Promise<NliResult[]> };

export function registerNLITraversalPlugin(threshold = Number(process.env.CQ_NLI_THRESHOLD ?? '0.72')) {
  try {
    // dynamic import so it doesn't explode if adapter isn't present
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const adapter = require('@/lib/nli/adapter').getNLIAdapter?.() as ReturnType<typeof getNLIAdapter> | undefined;
    if (!adapter) return;

    Hooks.onTraversal(async ({ dialogueId, pairs }) => {
      // map actId -> text (load minimal fields)
      const actIds = Array.from(new Set(pairs.flatMap(p => [p.posActId, p.negActId])));
      const acts = await prisma.ludicAct.findMany({
        where: { id: { in: actIds } },
        include: { design: true },
      });

      const byId = new Map(acts.map(a => [a.id, a]));
      const req: NliPair[] = [];
      const meta: { posId: string; negId: string }[] = [];

      for (const p of pairs) {
        const pos = byId.get(p.posActId), neg = byId.get(p.negActId);
        const premise = (pos?.expression ?? '').toString();
        const hypothesis = (neg?.expression ?? '').toString();
        if (premise && hypothesis) {
          req.push({ premise, hypothesis });
          meta.push({ posId: p.posActId, negId: p.negActId });
        }
      }

      if (!req.length) return;
      const out = await adapter.batch(req).catch(() => []);

      // store strong contradictions as NLILink rows; tag them via extJson on trace if you want
      for (let i = 0; i < out.length; i++) {
        const r = out[i]; const m = meta[i];
        if (!r) continue;
        await prisma.nLILink.create({
          data: {
            fromId: m.posId, toId: m.negId,
            relation: r.relation, score: r.score,
          },
        }).catch(() => null);
      }
    });
  } catch {
    // adapter not available; noop
  }
}
