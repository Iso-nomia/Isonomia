export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { entailDialogical } from '@/packages/entail/dialogical';

const zBody = z.object({
  textSentences: z.array(z.string().min(1)).min(1),
  hypothesis: z.string().min(1),
  nliAssist: z.boolean().optional().default(false),
  emitLudics: z.boolean().optional().default(false),
  deliberationId: z.string().optional(), // needed if emitLudics=true
});

const NLI_TAU = Number(process.env.NLI_TAU ?? 0.72);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = zBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }
  const { textSentences, hypothesis, nliAssist, emitLudics, deliberationId } = parsed.data;

  // 1) Classical pass
  let result = entailDialogical({ textSentences, hypothesis });

  // 2) NLI assist (only when undecided)
  let nli: { relation?: string; score?: number } | null = null;
  if (nliAssist && result.status === 'UNDECIDED') {
    try {
      const n = await fetch(new URL('/api/nli/batch', req.url), {
        method: 'POST',
        headers: { 'content-type':'application/json' },
            body: JSON.stringify({ pairs: [{ premise: textSentences.join('. '), hypothesis }], persist: false })
      }).then(r=>r.json());
      const r0 = n?.results?.[0];
      if (r0?.relation === 'entails' && (r0?.score ?? 0) >= NLI_TAU) {
        result = {
          ...result,
          status: 'ENTAILED',
          steps: [...result.steps, { rule: 'DIRECT_MATCH', used: ['NLI_ASSIST'], derived: hypothesis }],
          usedRules: [...result.usedRules, 'DIRECT_MATCH'] as any,
          classicalPatterns: result.classicalPatterns, // keep classical flags separate
        };
        nli = { relation: r0.relation, score: r0.score };
      }
    } catch {}
  }

  // 3) Optional: emit a short Ludics visualization (temporary designs)
  let viz: any = null;
  if (emitLudics && deliberationId) {
    try {
      const v = await fetch(new URL('/api/entail/dialogical/visualize', req.url), {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({ deliberationId, textSentences, hypothesis, steps: result.steps })
      }).then(r=>r.json());
      if (v?.ok) viz = v;
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    steps: result.steps,
    derived: result.derived,
    classicalPatterns: result.classicalPatterns,
    nli,
    viz, // { posDesignId, negDesignId, trace } if requested
  });
}
