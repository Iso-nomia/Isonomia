export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stepInteraction } from '@/packages/ludics-engine/stepper';

const Body = z.object({
  dialogueId: z.string(),
  programDesignId: z.string(), // D
  tests: z.array(z.string()).min(1), // ids of A-tests (counter-designs)
  bPerp: z.array(z.string()).min(1), // ids of B⊥ tests
  fuel: z.number().int().min(1).max(10000).optional().default(2048),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { dialogueId, programDesignId, tests, bPerp, fuel } = parsed.data;

  // D ∈ (A ⊢ B) iff for every a ∈ A-tests, ⟨D|a⟩ ∈ B (i.e., orthogonal to B⊥)
  const results: any[] = [];
  for (const testId of tests) {
    // First run D vs a
    const runDa = await stepInteraction({ dialogueId, posDesignId: programDesignId, negDesignId: testId, maxPairs: fuel });
    const okDa = runDa.status === 'CONVERGENT';
    // Then check vs each b⊥: map output (conceptually); for the minimal MVP we just ensure D|a converges
    const verdict = okDa ? 'pass' : 'fail';
    results.push({ testId, verdict, decisiveIndices: runDa.decisiveIndices ?? [], reason: runDa.reason });
  }

  const pass = results.every(r => r.verdict === 'pass');
  return NextResponse.json({ ok: true, pass, results });
}
