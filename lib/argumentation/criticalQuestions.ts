// lib/argumentation/criticalQuestions.ts
/**
 * @deprecated LEGACY FILE - Being phased out in favor of database-driven scheme system
 * 
 * This file contains hardcoded scheme definitions for 4 schemes only:
 * - ExpertOpinion, Consequences, Analogy, Sign
 * 
 * New implementation: lib/argumentation/schemeInference.ts now queries the database
 * and supports all schemes defined in ArgumentScheme table (currently 7+ schemes).
 * 
 * This file is kept for reference and backward compatibility.
 * DO NOT add new schemes here - use scripts/schemes.seed.ts instead.
 * 
 * Migration Status: October 31, 2025
 * - Phase 1: Database-driven inference implemented
 * - This file: Retained as fallback only
 */
export type SchemeId = 'ExpertOpinion' | 'Consequences' | 'Analogy' | 'Sign';

export type CriticalQuestion = { id: string; text: string; severity?: 'low'|'med'|'high' };

const CQS: Record<SchemeId, CriticalQuestion[]> = {
  ExpertOpinion: [
    { id: 'eo-1', text: 'Is the cited person a genuine expert in the relevant domain?', severity: 'high' },
    { id: 'eo-2', text: 'Is the expert unbiased and credible (conflicts of interest disclosed)?', severity: 'high' },
    { id: 'eo-3', text: 'Did the expert actually assert the stated claim?', severity: 'med' },
    { id: 'eo-4', text: 'Is the expert’s field relevant to the specific claim?', severity: 'med' },
    { id: 'eo-5', text: 'Is the expert view consistent with the balance of expert opinion?', severity: 'med' },
  ],
  Consequences: [
    { id: 'ac-1', text: 'Are the predicted consequences likely (with evidence/uncertainty)?', severity: 'high' },
    { id: 'ac-2', text: 'Are important consequences (incl. side-effects) omitted?', severity: 'high' },
    { id: 'ac-3', text: 'Are value trade-offs explicit and reasonable?', severity: 'med' },
    { id: 'ac-4', text: 'Are there alternatives with better net consequences?', severity: 'med' },
  ],
  Analogy: [
    { id: 'an-1', text: 'Are the compared cases alike in the relevant respects?', severity: 'high' },
    { id: 'an-2', text: 'Are there critical disanalogies that weaken the analogy?', severity: 'high' },
  ],
  Sign: [
    { id: 'sg-1', text: 'Is the cited sign reliably correlated with the conclusion?', severity: 'high' },
    { id: 'sg-2', text: 'Could there be confounders producing the same sign?', severity: 'high' },
  ],
};

/**
 * @deprecated Use lib/argumentation/schemeInference.ts -> inferSchemesFromText() instead
 * 
 * Heuristic scheme hints from shallow features (optional).
 * This function only knows about 4 hardcoded schemes.
 * The new implementation queries the database and supports 7+ schemes with taxonomy-based scoring.
 */
export function inferSchemesFromText(text: string): SchemeId[] {
  const t = text.toLowerCase();
  const out = new Set<SchemeId>();
  if (/(phd|m\.?d\.?|prof|dr\.|licensed|certified|peer[-\s]reviewed|randomized|trial|cohort)/i.test(text)) {
    out.add('ExpertOpinion');
  }
  if (/(cost[-\s]?benefit|economic|security|threat|risk|burden|benefit|impact)/i.test(text)) {
    out.add('Consequences');
  }
  if (/\b(like|similar to|as if|as though|akin to)\b/i.test(text)) out.add('Analogy');
  if (/\b(sign|indicator|symptom|signal|proxy)\b/i.test(text)) out.add('Sign');
  return Array.from(out.size ? out : ['Consequences']); // default to consequences
}

/**
 * @deprecated Use database queries instead: prisma.criticalQuestion.findMany({ where: { schemeId } })
 */
export function questionsForScheme(s: SchemeId): CriticalQuestion[] {
  return CQS[s] || [];
}

/**
 * Convert unresolved critical questions to *implicit undercuts* on an argument.
 * Each unresolved CQ creates a virtual node "cq:<id>" that undercuts targetId.
 */
export function cqUndercuts(targetId: string, unresolved: CriticalQuestion[]) {
  const nodes = unresolved.map(q => ({ id: `cq:${targetId}:${q.id}`, label: `CQ: ${q.id}`, text: q.text }));
  const edges = unresolved.map(q => ({ from: `cq:${targetId}:${q.id}`, to: targetId, type: 'undercut' as const }));
  return { nodes, edges };
}
