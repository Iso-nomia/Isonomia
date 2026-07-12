export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { zCommitmentsApply } from 'packages/ludics-rest/zod';
import { applyToCS, interactCE } from 'packages/ludics-engine/commitments';
import { prisma } from '@/lib/prismaclient';
import { Hooks } from 'packages/ludics-engine/hooks';

export async function POST(req: NextRequest) {
  const parsed = zCommitmentsApply.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  }
  const { dialogueId, ownerId, ops, autoPersistDerived } = parsed.data;

  try {
    const applyRes = await applyToCS(dialogueId, ownerId, ops);
    const infer = await interactCE(dialogueId, ownerId);

    // Optionally persist derived facts into CS for visibility in the panel
    let persisted: string[] = [];
    if (autoPersistDerived && infer.derivedFacts.length) {
      const addOps = infer.derivedFacts.map(d => ({ label: d.label, basePolarity: 'pos' as const, baseLocusPath: '0', derived: true }));
      const again = await applyToCS(dialogueId, ownerId, { add: addOps });
      persisted = again.added;
    }

    Hooks.emitCSUpdated({
      ownerId, csId: infer.csId ?? applyRes.csId,
      derived: infer.derivedFacts, contradictions: infer.contradictions,
    });

    // If contradiction exists, surface a friendly code for UI toast
    const blocked = infer.contradictions.length > 0;

    return NextResponse.json({
      ...applyRes,
      ok: true,
      derivedFacts: infer.derivedFacts,
      contradictions: infer.contradictions,
      persistedDerivedIds: persisted,
      blocked,
      code: blocked ? 'CS_CONTRADICTION' : undefined,
    }, { status: 200 });
  } catch (error: any) {
    // Handle validation errors from applyToCS
    if (error?.message?.includes('Invalid rule syntax')) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        code: 'RULE_VALIDATION_ERROR'
      }, { status: 400 });
    }
    
    // Re-throw other errors
    throw error;
  }
}
