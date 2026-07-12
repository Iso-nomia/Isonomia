// lib/practical/mcda.ts
export type Crit = { id: string; label: string; weight: number; kind?: 'prudential'|'moral' };
export type Opt  = { id: string; label: string; desc?: string };
export type Scores = Record<string, Record<string, number>>; // optionId -> { criterionId: number }

export function computeMcda(criteria: Crit[], options: Opt[], scores: Scores) {
  const sumW = criteria.reduce((s, c) => s + (c.weight ?? 0), 0) || 1;
  const wNorm: Record<string, number> = {};
  for (const c of criteria) wNorm[c.id] = (c.weight ?? 0) / sumW;

  const totals: Record<string, number> = {};
  const perCriterionScale: Record<string, { min: number; max: number }> = {};
  for (const c of criteria) {
    let min = Infinity, max = -Infinity;
    for (const o of options) {
      const v = scores[o.id]?.[c.id] ?? 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;
    perCriterionScale[c.id] = { min, max };
  }

  for (const o of options) {
    let total = 0;
    for (const c of criteria) {
      const raw = scores[o.id]?.[c.id] ?? 0;
      const { min, max } = perCriterionScale[c.id];
      const norm = max > min ? (raw - min) / (max - min) : 0;
      total += (wNorm[c.id] ?? 0) * norm;
    }
    totals[o.id] = total;
  }

  let bestOptionId: string | null = null;
  let bestVal = -Infinity;
  for (const o of options) {
    const t = totals[o.id] ?? 0;
    if (t > bestVal) { bestVal = t; bestOptionId = o.id; }
  }

  return { bestOptionId, totals, weightsNormalized: wNorm, perCriterionScale };
}
