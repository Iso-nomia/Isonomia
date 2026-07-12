import { prisma } from '@/lib/prismaclient';

/**
 * A 'directory collision' means: at the same base locus path ξ,
 * both sides have positive openers that *introduce* overlapping ramification labels.
 * (Before a shift/delocation they are not disjoint, so local with/plus won't behave as intended.)
 */
export async function detectDirectoryCollisions(input: { dialogueId: string, posDesignId: string, negDesignId: string }) {
  const acts = await prisma.ludicAct.findMany({
    where: { designId: { in: [input.posDesignId, input.negDesignId] } },
    include: { locus: { select: { path: true } } },
  });

  type OpenMap = Record<string, { P:Set<string>; O:Set<string> }>;
  const map: OpenMap = {};

  for (const a of acts) {
    if (a.kind !== 'PROPER' || a.polarity !== 'P') continue;
    const base = a.locus?.path ?? '0';
    const opens = Array.isArray(a.ramification) ? a.ramification.map(String) : [];
    if (!map[base]) map[base] = { P: new Set(), O: new Set() };
    const bucket = a.designId === input.posDesignId ? map[base].P : map[base].O;
    for (const i of opens) bucket.add(i);
  }

  const collisions: { base: string; overlap: string[] }[] = [];
  for (const [base, { P, O }] of Object.entries(map)) {
    const overlap = [...P].filter(i => O.has(i));
    if (overlap.length) collisions.push({ base, overlap });
  }
  return collisions;
}
