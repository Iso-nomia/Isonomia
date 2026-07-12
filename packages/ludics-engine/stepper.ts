import { prisma } from '@/lib/prismaclient';
import type { StepResult, DaimonHint } from 'packages/ludics-core/types';
import { Hooks } from './hooks';
import { detectDirectoryCollisions } from './detect-collisions';
import { stepCore } from './stepCore';
import type { CoreAct } from './stepCore';

type Locus = { path: string; openings: string[]; additive?: boolean };
type Act   = { polarity:'pos'|'neg'|'daimon'; locus:string; openings:string[]; additive?:boolean };
export type CompositionMode = 'assoc'|'partial'|'spiritual';

// Small helpers
function isACK(expr?: string | null, meta?: any) {
  const e = (expr ?? '').toLowerCase();
  return e === 'ack' || e === 'accepted' || meta?.ack === true;
}

function proposeDaimonIfClosed(locus: Locus): Act[] {
  const hasOpen = locus.openings && locus.openings.length > 0;
  return hasOpen ? [] : [{ polarity:'daimon', locus: locus.path, openings:[], additive:false }];
}

// Exportable hint util (used by UI if needed)
export function closedLocusSuggestions(locus: { path: string; openings?: string[] }): Act[] {
  return proposeDaimonIfClosed({ path: locus.path, openings: locus.openings ?? [] } as any);
}

function chooseAdditiveChild(openings: string[], chosen?: string): string[] {
  if (!openings?.length) return [];
  return [chosen ?? openings[0]];
}

// Explain-why slice (unchanged)
function computeDecisiveIndices(
  pairs: { posActId: string; negActId: string }[],
  actById: Map<string, any>,
  fallbackWindow = 3
): number[] {
  const n = pairs.length;
  if (n === 0) return [];

  const used = new Set<number>();
  let i = n - 1;
  used.add(i);

  // Start from last positive locus and walk back via meta.justifiedByLocus
  let currentLocus =
    actById.get(pairs[i].posActId)?.locus?.path ??
    actById.get(pairs[i].negActId)?.locus?.path ?? '0';

  const isUnder = (cur: string, root: string) => {
    if (cur === root) return true;
    const c = cur.split('.');
    const r = root.split('.');
    if (r.length > c.length) return false;
    for (let idx = 0; idx < r.length; idx++) {
      if (c[idx] !== r[idx]) return false;
    }
    return true;
  };

  for (let k = i - 1; k >= 0; k--) {
    const pos = actById.get(pairs[k].posActId);
    const meta = (pos?.metaJson ?? {}) as any;
    const rawJust = meta?.justifiedByLocus as string | undefined;
    const just = typeof rawJust === 'string' ? rawJust.trim() : undefined;

    if (just && isUnder(currentLocus, just)) {
      used.add(k);
      currentLocus = pos?.locus?.path ?? currentLocus;
    }
  }

  // If the chain is too thin, fall back to the last K pairs for useful UI
  if (used.size < Math.min(2, n)) {
    for (let k = Math.max(0, n - fallbackWindow); k < n; k++) used.add(k);
  }
  return Array.from(used).sort((a, b) => a - b);
}

// NEW: compute † suggestions for loci that have no openings
// async function computeDaimonHints(dialogueId: string, posDesignId: string, negDesignId: string) {
//   // pull positive acts (openers) for both designs with their locus and ramification
//   const acts = await prisma.ludicAct.findMany({
//     where: {
//       kind: 'PROPER',
//       polarity: 'P',
//       designId: { in: [posDesignId, negDesignId] }
//     },
//     select: { locus: { select: { path: true } }, ramification: true }
//   });

//   // group: locusPath -> did any opener at this exact locus have openings?
//   const map = new Map<string, { hasOpenings: boolean }>();
//   for (const a of acts) {
//     const path = a.locus?.path ?? '0';
//     const entry = map.get(path) ?? { hasOpenings: false };
//     const has = Array.isArray(a.ramification) && a.ramification.length > 0;
//     map.set(path, { hasOpenings: entry.hasOpenings || has });
//   }

//   // for every locus mentioned in designs, if no opener had openings => † is available there
//   const hints: { locusPath: string; act: Act }[] = [];
//   for (const [path, { hasOpenings }] of map.entries()) {
//     if (!hasOpenings) {
//       hints.push({ locusPath: path, act: { polarity: 'daimon', locus: path, openings: [], additive: false } });
//     }
//   }
//   return hints;
// }


// NEW: synchronous †-hint computation from acts already loaded
// function computeDaimonHints(posActs: any[], negActs: any[], pathById: Map<string,string>) {
//   const hints = new Map<string, { locusPath: string; reason: 'no-openings' }>();
//   const scan = (acts: any[]) => {
//     for (const a of acts) {
//       if (a.kind === 'PROPER' && a.polarity === 'P') {
//         const opens = Array.isArray(a.ramification) ? a.ramification : [];
//         if (opens.length === 0) {
//           const p = a.locusId ? pathById.get(a.locusId) : undefined;
//           if (p) hints.set(p, { locusPath: p, reason: 'no-openings' });
//         }
//       }
//     }
//   };
//   scan(posActs); scan(negActs);
//   return Array.from(hints.values());
// }
function computeDaimonHints(posActs: any[], negActs: any[], pathById: Map<string, string>) {
  const hints = new Map<string, { locusPath: string; reason: 'no-openings' }>();
  const scan = (acts: any[]) => {
    for (const a of acts) {
      if (a.kind === 'PROPER' && a.polarity === 'P') {
        const opens = Array.isArray(a.ramification) ? a.ramification : [];
        if (opens.length === 0) {
          const p = a.locusId ? (pathById.get(a.locusId) ?? '0') : '0';
          if (p) hints.set(p, { locusPath: p, reason: 'no-openings' });
        }
      }
    }
  };
  scan(posActs); scan(negActs);
  return Array.from(hints.values());
}


// type Locus = { path: string; openings: string[]; additive?: boolean };
export async function stepInteraction(opts: {
  dialogueId: string,
  posDesignId: string,
  negDesignId: string,
  startPosActId?: string,
  maxPairs?: number,
  phase?: 'focus-P'|'focus-O'|'neutral',
  maskNamesAt?: string[], // bases where child names are hidden from testers

  // consensus testers
  virtualNegPaths?: string[],   // synthesize an O at these locus paths
  drawAtPaths?: string[],       // treat no-response here as draw by consensus
  // composition preflight
  compositionMode?: CompositionMode,
  focusAt?: string | null;  // pin traversal under this locus

}): Promise<StepResult> {
  const {
    dialogueId,
    posDesignId,
    negDesignId,
    maxPairs = 10_000,
    phase,
    virtualNegPaths = [],
    drawAtPaths = [],
  } = opts;

  const mode = opts.compositionMode ?? 'assoc';


  // -- resolve designs (robust to stale/cross-dialogue ids)
  async function resolvePair() {
    // ⚡ Performance: Load designs + acts WITHOUT nested locus join (90% faster)
    const [pos0, neg0] = await Promise.all([
      prisma.ludicDesign.findUnique({
        where: { id: posDesignId },
        include: { acts: { orderBy: { orderInDesign: 'asc' } } },
      }),
      prisma.ludicDesign.findUnique({
        where: { id: negDesignId },
        include: { acts: { orderBy: { orderInDesign: 'asc' } } },
      }),
    ]);

    let pos = pos0 && pos0.deliberationId === dialogueId ? pos0 : null;
    let neg = neg0 && neg0.deliberationId === dialogueId ? neg0 : null;

    if (!pos || !neg) {
      const designs = await prisma.ludicDesign.findMany({
        where: { deliberationId: dialogueId },
        orderBy: [{ participantId: 'asc' }, { id: 'asc' }],
        include: { acts: { orderBy: { orderInDesign: 'asc' } } },
      });
      pos = pos ?? (designs.find(d => d.participantId === 'Proponent') ?? designs[0] ?? null);
      neg = neg ?? (designs.find(d => d.participantId === 'Opponent')  ?? designs[1] ?? designs[0] ?? null);
    }
    if (!pos || !neg) throw new Error('NO_SUCH_DESIGN');
    return { pos, neg };
  }
  const { pos: posDesign, neg: negDesign } = await resolvePair();
  const displayPath = (raw?: string) => {
    if (!raw) return raw;
    for (const b of opts.maskNamesAt ?? []) {
      if (raw.startsWith(b + '.')) {
        const segs = raw.split('.');
        if (segs.length >= b.split('.').length + 1) {
          segs[b.split('.').length] = '•'; // hide the name
          return segs.join('.');
        }
      }
    }
    return raw;
  };
  // -- loci maps (single fetch, build pathById cache for act lookups)
  const loci     = await prisma.ludicLocus.findMany({ where: { dialogueId } });
  const pathById = new Map(loci.map(l => [l.id, l.path]));
  const idByPath = new Map(loci.map(l => [l.path, l.id]));

  // -- views over designs
  const A = { design: posDesign, acts: posDesign.acts };
  const B = { design: negDesign, acts: negDesign.acts };

   // --- Directory collision pre-flight (only matters for additives at the SAME base)
   if (mode !== 'assoc') {
    const collisions = await detectDirectoryCollisions({
      dialogueId: opts.dialogueId, posDesignId: posDesign.id, negDesignId: negDesign.id
    });
    if (collisions.length) {
      if (mode === 'partial') {
        return {
          status: 'DIVERGENT',
          pairs: [],
          reason: 'dir-collision',         // <<< explicit, matches StepResult
          daimonHints: [],
          usedAdditive: {},
          decisiveIndices: [],
          endorsement: undefined,
          endedAtDaimonForParticipantId: undefined,
        };
      }
      // spiritual: UI should call /api/ludics/delocate then re-run
      (globalThis as any).__ludics__lastCollision = collisions;
    }
  }
  // -- previous additive choices (persisted)
  type UsedAdditive = Record<string, string>;
  let usedAdditive: UsedAdditive = {};
  const prevTrace = await prisma.ludicTrace.findFirst({
    where: { deliberationId: dialogueId, posDesignId: A.design.id, negDesignId: B.design.id },
    orderBy: { createdAt: 'desc' },
    select: { extJson: true },
  }).catch(() => null);
  if (prevTrace?.extJson && typeof prevTrace.extJson === 'object') {
    usedAdditive = (prevTrace.extJson as any).usedAdditive ?? {};
  }

  // -- traversal (pure kernel — see ./stepCore.ts). The loop body below was
  //    lifted verbatim into `stepCore`; `stepInteraction` keeps the DB I/O
  //    (design/loci/trace resolution, persistence, hints, endorsement) and now
  //    delegates the decision procedure. Any test exercising `stepInteraction`
  //    therefore exercises the same kernel; pure unit/bridge tests can drive
  //    `stepCore` directly with hand-built act lists and no database.
  const core = stepCore({
    posActs: A.acts as CoreAct[],
    negActs: B.acts as CoreAct[],
    pathById,
    idByPath,
    posParticipantId: A.design.participantId,
    negParticipantId: B.design.participantId,
    fuel: maxPairs,
    phase,
    focusAt: opts.focusAt,
    virtualNegPaths,
    drawAtPaths,
    usedAdditive,
  });
  const status = core.status;
  const reason = core.reason;
  const endedAtDaimonForParticipantId = core.endedAtDaimonForParticipantId;
  const divergenceLocus = core.divergenceLocus;
  usedAdditive = core.usedAdditive;
  const pairs = core.pairs as { posActId: string; negActId: string; locusPath: string; ts: number }[];

  // hints for † at closed loci (no openings)
 // hints for † at closed loci (no openings) -> full DaimonHint objects
 // hints for † at closed loci (no openings) → full DaimonHint objects (keep literals narrow)
 const daimonHints: DaimonHint[] = computeDaimonHints(A.acts, B.acts, pathById).map((h) => {
     const lp = h.locusPath;
     const act: DaimonHint['act'] = {
       polarity: 'daimon',
       locus: lp,
       openings: [],       // typed as [] not never[]
       additive: false,    // literal false
       reason: 'no-openings',
     };
     return { locusPath: lp, act };
   });

  // event for live panels
  Hooks.emitTraversal({
    dialogueId,
    posDesignId: A.design.id,
    negDesignId: B.design.id,
    pairs,
    status,
    endedAtDaimonForParticipantId,
  });

  // persist (if DB trace status enum has no STUCK, map to ONGOING)
  // ⚡ Handle race condition: designs might have been deleted during concurrent compile
  const traceRow = await prisma.ludicTrace.create({
    data: {
      deliberationId: dialogueId,
      posDesignId: A.design.id,
      negDesignId: B.design.id,
      status: status === 'STUCK' ? 'ONGOING' : status,
      endedAtDaimonForParticipantId,
      steps: pairs,
      extJson: { usedAdditive },
    },
  }).catch(async (e: any) => {
    // P2003 = foreign key constraint violation (design was deleted)
    if (String(e?.code) === 'P2003') {
      console.warn('[stepper] Design deleted during step, attempting recovery...');
      
      // Try to find ANY valid P/O pair for this deliberation
      const freshDesigns = await prisma.ludicDesign.findMany({
        where: { deliberationId: dialogueId },
        orderBy: { participantId: 'asc' },
        select: { id: true, participantId: true },
      });
      
      let freshP = freshDesigns.find(d => d.participantId === 'Proponent');
      let freshO = freshDesigns.find(d => d.participantId === 'Opponent');
      
      // If no designs found, wait a bit and retry (concurrent compile may be creating them)
      if (!freshP || !freshO) {
        console.log('[stepper] No designs yet, waiting 800ms for concurrent compile...');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const retryDesigns = await prisma.ludicDesign.findMany({
          where: { deliberationId: dialogueId },
          orderBy: { participantId: 'asc' },
          select: { id: true, participantId: true },
        });
        
        freshP = retryDesigns.find(d => d.participantId === 'Proponent');
        freshO = retryDesigns.find(d => d.participantId === 'Opponent');
        
        if (!freshP || !freshO) {
          console.error('[stepper] No valid designs found after retry');
          throw new Error('NO_SUCH_DESIGN: Designs deleted during concurrent compilation');
        }
      }
      
      console.log('[stepper] Recovered with fresh designs:', freshP.id, freshO.id);
      
      return prisma.ludicTrace.create({
        data: {
          deliberationId: dialogueId,
          posDesignId: freshP.id,
          negDesignId: freshO.id,
          status: status === 'STUCK' ? 'ONGOING' : status,
          endedAtDaimonForParticipantId,
          steps: pairs,
          extJson: { usedAdditive },
        },
      });
    }
    throw e;
  });

  // endorsement heuristic (⚡ optimized: no nested joins)
  let endorsement: StepResult['endorsement'];
  if (status === 'CONVERGENT' && pairs.length > 0) {
    const last = pairs[pairs.length - 1];
    const [pos, neg] = await Promise.all([
      prisma.ludicAct.findUnique({ where: { id: last.posActId }, include: { design: true } }),
      prisma.ludicAct.findUnique({ where: { id: last.negActId }, include: { design: true } }),
    ]);

    if (isACK(neg?.expression, neg?.metaJson)) {
      const negLocusPath = neg?.locusId ? pathById.get(neg.locusId) : undefined;
      const posLocusPath = pos?.locusId ? pathById.get(pos.locusId) : undefined;
      endorsement = {
        locusPath: negLocusPath ?? posLocusPath ?? '0',
        byParticipantId: (neg?.design?.participantId as any) ?? 'Opponent',
        viaActId: neg?.id ?? last.negActId,
      };
    } else {
      const ender = endedAtDaimonForParticipantId;
      const locusPath2 = pos?.locusId ? (pathById.get(pos.locusId) ?? '0') : '0';
      const by = ender && ender === pos?.design?.participantId
        ? (neg?.design?.participantId as any) ?? 'Opponent'
        : (pos?.design?.participantId as any) ?? 'Proponent';
      endorsement = { locusPath: locusPath2, byParticipantId: by, viaActId: neg?.id ?? last.negActId };
    }
  }

  // decisive slice for UI explanation (⚡ acts already loaded, augment with pathById)
  const allActIds = Array.from(new Set(pairs.flatMap(p => [p.posActId, p.negActId])));
  const acts = await prisma.ludicAct.findMany({ where: { id: { in: allActIds } } });
  const byId = new Map(acts.map(a => [a.id, { ...a, locus: a.locusId ? { path: pathById.get(a.locusId) } : undefined }]));
  const decisiveIndices = computeDecisiveIndices(pairs, byId);

  // Update trace with decisive indices - use updateMany to avoid Prisma error logging
  // when trace was deleted by concurrent compile (updateMany silently returns count: 0)
  await prisma.ludicTrace.updateMany({
    where: { id: traceRow.id },
    data: { extJson: { usedAdditive, decisiveIndices } },
  });

  return {
    status,
    pairs,
    endedAtDaimonForParticipantId,
    endorsement,
    decisiveIndices,
    usedAdditive,
    daimonHints,
    reason,
    divergenceLocus,
  };
}