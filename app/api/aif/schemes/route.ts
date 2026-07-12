// app/api/aif/schemes/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';

// Formal argument structures for common schemes (Walton-style)
const FORMAL_STRUCTURES: Record<string, { majorPremise: string; minorPremise: string; conclusion: string }> = {
  expert_opinion: {
    majorPremise: "Source E is an expert in subject domain S containing proposition A.",
    minorPremise: "E asserts that proposition A is true (false).",
    conclusion: "A is true (false)."
  },
  popular_opinion: {
    majorPremise: "If the majority or a large group accepts proposition A, then A has presumptive support.",
    minorPremise: "The majority (or group G) accepts that A is true.",
    conclusion: "A is presumed true."
  },
  popular_practice: {
    majorPremise: "If most people do X in situation S, then X is presumptively the right thing to do in S.",
    minorPremise: "Most people do X in situation S.",
    conclusion: "X is presumptively the right thing to do in S."
  },
  witness_testimony: {
    majorPremise: "Witness W is in a position to know about events of type E.",
    minorPremise: "W testifies that event E occurred.",
    conclusion: "E occurred."
  },
  analogy: {
    majorPremise: "Case C₁ is similar to case C₂ in relevant respects R.",
    minorPremise: "Property P holds in case C₁.",
    conclusion: "Property P also holds in case C₂."
  },
  causal: {
    majorPremise: "If event C occurs, then event E generally follows.",
    minorPremise: "Event C has occurred.",
    conclusion: "Event E will (or did) occur."
  },
  practical_reasoning: {
    majorPremise: "Agent A has goal G.",
    minorPremise: "Doing action X is a means to realize goal G.",
    conclusion: "Agent A ought to (or should) do action X."
  },
  positive_consequences: {
    majorPremise: "If action A brings about good consequences, then A should be done.",
    minorPremise: "Action A will bring about good consequences.",
    conclusion: "Action A should be done."
  },
  negative_consequences: {
    majorPremise: "If action A brings about bad consequences, then A should not be done.",
    minorPremise: "Action A will bring about bad consequences.",
    conclusion: "Action A should not be done."
  },
  verbal_classification: {
    majorPremise: "For all x, if x has property F, then x can be classified as having property G.",
    minorPremise: "Individual a has property F.",
    conclusion: "a has property G."
  },
  definition_to_classification: {
    majorPremise: "For all x, if x has defining properties F₁, F₂, ... Fₙ, then x is a G.",
    minorPremise: "a has defining properties F₁, F₂, ... Fₙ.",
    conclusion: "a is a G."
  },
  argument_from_example: {
    majorPremise: "If example E is representative of population P, then what holds for E likely holds for P.",
    minorPremise: "Example E has property F.",
    conclusion: "Members of population P likely have property F."
  },
  slippery_slope: {
    majorPremise: "If we take step A, it will lead to steps B, C, ..., ending in unacceptable consequence Z.",
    minorPremise: "We are considering taking step A.",
    conclusion: "We should not take step A (to avoid Z)."
  }
};

function normalize(s: any) {
  return {
    id: s.id,
    key: s.key,
    name: s.title || s.name || s.key,
    slotHints: s.slotHints ?? { premises: [{ role: 'reason', label: 'Reason' }] },
    // Phase 6: Use CriticalQuestion table relation (not JSON cq field)
    cqs: Array.isArray(s.cqs)
      ? s.cqs.map((cq: any) => ({
          cqKey: cq.cqKey,
          text: cq.text,
          attackType: cq.attackType,
          targetScope: cq.targetScope,
        }))
      : [],
    // Phase 6D: Include hierarchy metadata
    parentSchemeId: s.parentSchemeId ?? null,
    clusterTag: s.clusterTag ?? null,
    // Phase 6E: Include formal argument structure
    formalStructure: FORMAL_STRUCTURES[s.key] || null,
    // keep validators server-side; add later to the payload if/when the UI needs them
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ensure = url.searchParams.get('ensure') === '1';

  if (ensure) {
    // Seed Expert Opinion if table empty
    const hasAny = await prisma.argumentScheme.count();
    if (!hasAny) {
      await prisma.argumentScheme.create({
        data: {
          key: 'expert_opinion',
          name: 'Argument from Expert Opinion',
          slotHints: {
            premises: [
              { role: 'expert_statement', label: 'Expert’s statement' },
              { role: 'credibility',      label: 'Expert is credible' },
            ],
          },
          // seed some baseline CQs
          cq: { questions: [
            'Is the source a genuine expert?',
            'Is the field relevant?',
            'Is there consensus?'
          ] },
          // (optional) validators for future server/client checks
          validators: {
            slots: {
              // Example expectations (can be refined as you introduce claimType)
              expert_statement: { expects: 'Assertion', required: true },
              credibility:      { expects: 'Assertion', required: false },
              conclusion:       { expects: 'Assertion', required: true },
            }
          } as any,
        } as any,
      });
    }

    // A minimal defeasible "Because …" scheme
    await prisma.argumentScheme.upsert({
      where: { key: 'bare_assertion' },
      update: {},
      create: {
        key: 'bare_assertion',
        name: 'Bare Assertion',
        slotHints: { premises: [{ role: 'reason', label: 'Reason' }] },
        summary: 'A simple, defeasible argument consisting of a single reason supporting a conclusion.',
        validators: {
          slots: {
            reason:     { expects: 'Assertion', required: true },
            conclusion: { expects: 'Assertion', required: true }
          }
        } as any
      } as any,
    });
  }

  const rows = await prisma.argumentScheme.findMany({ 
    orderBy: { name: 'asc' },
    include: { cqs: true } // Phase 6: Include CriticalQuestion relation
  });
  return NextResponse.json(
    { ok: true, items: rows.map(normalize) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
