// packages/ludics-engine/compose.ts
import { prisma } from '@/lib/prismaclient';
import { cloneDesignWithShift } from './delocate';

export type CompositionMode = 'assoc'|'partial'|'spiritual';

function directoryAtBase(design: any, baseLocusId: string): string[] {
  // Directory = union of ramification of P openers **at the base**
  const out = new Set<string>();
  for (const a of design.acts) {
    if (a.kind === 'PROPER' && a.polarity === 'P' && a.locusId === baseLocusId) {
      const I = Array.isArray(a.ramification) ? a.ramification : [];
      for (const i of I) out.add(String(i));
    }
  }
  return [...out];
}

export async function preflightComposition(opts: {
  dialogueId: string;
  posDesignId: string;
  negDesignId: string;
  mode: CompositionMode;
}) {
  const { dialogueId, posDesignId, negDesignId, mode } = opts;

  const [pos, neg] = await Promise.all([
    prisma.ludicDesign.findUnique({
      where: { id: posDesignId },
      include: { acts: { include: { locus: true }, orderBy: { orderInDesign: 'asc' } } }
    }),
    prisma.ludicDesign.findUnique({
      where: { id: negDesignId },
      include: { acts: { include: { locus: true }, orderBy: { orderInDesign: 'asc' } } }
    }),
  ]);
  if (!pos || !neg || pos.deliberationId !== dialogueId || neg.deliberationId !== dialogueId) {
    throw new Error('NO_SUCH_DESIGN');
  }

  // Base locus id for this dialogue's root
  const base = await prisma.ludicLocus.findFirst({ where: { dialogueId, path: '0' } });
  if (!base) throw new Error('NO_BASE_LOCUS');

  const dirP = new Set(directoryAtBase(pos, base.id));
  const dirO = new Set(directoryAtBase(neg, base.id));
  const collisions = [...dirP].filter(x => dirO.has(x));

  if (mode === 'assoc') {
    return { ok: true as const, posDesignId, negDesignId, collisions: [] as string[], note: 'assoc' };
  }

  if (mode === 'partial') {
    if (collisions.length > 0) {
      // Block incompatible join
      return { ok: false as const, reason: 'dir-collision' as const, collisions };
    }
    return { ok: true as const, posDesignId, negDesignId, collisions, note: 'partial-ok' };
  }

  // 'spiritual' – auto-insert shifts to make directories disjoint (ρL, ρR), see notes. :contentReference[oaicite:5]{index=5}
  if (mode === 'spiritual') {
    if (collisions.length === 0) {
      return { ok: true as const, posDesignId, negDesignId, collisions, note: 'spiritual-noop' };
    }
    // Clone both sides under 0.L / 0.R (injective renaming). :contentReference[oaicite:6]{index=6}
    const [p2, n2] = await Promise.all([
      cloneDesignWithShift(posDesignId, 'L'),
      cloneDesignWithShift(negDesignId, 'R'),
    ]);
    return {
      ok: true as const,
      posDesignId: p2.id!,
      negDesignId: n2.id!,
      collisions,
      note: 'shift-inserted' as const,
      shifted: { posTag: 'L', negTag: 'R' }
    };
  }

  // Exhaustive
  return { ok: true as const, posDesignId, negDesignId, collisions: [], note: 'assoc' };
}
