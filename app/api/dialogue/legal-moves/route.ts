export const dynamic = "force-dynamic";

// app/api/dialogue/legal-moves/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { stepInteraction } from '@/packages/ludics-engine/stepper';
import { legalAttacksFor } from '@/lib/dialogue/legalMoves'; // shape cues
import { resolveCitationCallerUserId, isMcpBearer, namespaceForSpeakAs } from '@/lib/citation/mcpAuth';
import type { RCode, WCode } from '@/lib/dialogue/codes';
import { codeHelp } from '@/lib/dialogue/codes';

// Testing mode: only available in development.
const TESTING_MODE =
  process.env.NODE_ENV === "development" &&
  process.env.DIALOGUE_TESTING_MODE === "true";

const Q = z.object({
  deliberationId: z.string().min(5),
  targetType: z.enum(['argument','claim','card']),
  targetId: z.string().min(5),
  locusPath: z.string().optional(),
  // §4 side capability (MCP-bearer only): compute legality for the side the
  // caller intends to move on. author-only GROUNDS / non-author WHY depend on it.
  speakAs: z.string().min(1).max(64).optional(),
});

type Move = {
  kind: 'ASSERT'|'WHY'|'GROUNDS'|'RETRACT'|'CONCEDE'|'CLOSE'|'THEREFORE'|'SUPPOSE'|'DISCHARGE';
  label: string;
  payload?: any;
  disabled?: boolean;
  reason?: string;
  force?: 'ATTACK'|'SURRENDER'|'NEUTRAL';
  relevance?: 'likely'|'unlikely'|null;
  postAs?: { targetType: 'argument'|'claim'|'card'; targetId: string }; // R7 hint
};

  type Verdict = { code: string; context?: Record<string, any> };
  type MoveWithVerdict = Move & { verdict?: Verdict };

export async function GET(req: NextRequest) {
  const qs = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = Q.safeParse(qs);
  if (!parsed.success) {
    return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  }
    const { deliberationId, targetType, targetId, locusPath, speakAs } = parsed.data;

  // --- parallelize independent reads ---
  const [targetTextRow, rows, targetAuthorRow, lastTerminator] = await Promise.all([
    targetType === 'claim'
      ? prisma.claim.findUnique({ where: { id: targetId }, select: { text: true } })
      : prisma.argument.findUnique({ where: { id: targetId }, select: { text: true } }),
  prisma.dialogueMove.findMany({
      where: { deliberationId, targetType, targetId, kind: { in: ['WHY','GROUNDS'] } },
      orderBy: { createdAt: 'asc' },
      select: { kind: true, payload: true, createdAt: true },
    }),
    targetType === 'argument'
      ? prisma.argument.findFirst({ where: { id: targetId }, select: { authorId: true } })
      : prisma.claim.findFirst({ where: { id: targetId }, select: { createdById: true } }),
    prisma.dialogueMove.findFirst({
      where: {
        deliberationId, targetType, targetId,
        OR: [
          { kind:'CLOSE', ...(locusPath ? { payload: { path:['locusPath'], equals: locusPath } } : {}) },
          { kind:'ASSERT', payload: { path:['as'], equals: 'CONCEDE' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { id:true, kind:true, createdAt:true }
    })
  ]);
  const targetText = targetTextRow?.text ?? null;
 

  type Row = { kind:'WHY'|'GROUNDS'; payload:any; createdAt:Date };
  const latestByKey = new Map<string, Row>();
  for (const r of rows as Row[]) {
    // Backward compatibility: use cqId if present, otherwise generate key from locus + kind
    const key = r?.payload?.cqId || `legacy-${r?.payload?.locusPath || '0'}`;
    const prev = latestByKey.get(key);
    if (!prev || r.createdAt > prev.createdAt) latestByKey.set(key, r);
  }
  const openKeys = [...latestByKey.entries()].filter(([,v]) => v.kind === 'WHY').map(([k]) => k);
  const anyGrounds = [...latestByKey.values()].some(v => v.kind === 'GROUNDS');

  // Who can answer / who can ask?
  const targetAuthorId: string | null =
    (targetType === 'argument' ? (targetAuthorRow as any)?.authorId : (targetAuthorRow as any)?.createdById) ?? null;
 // Cookie/Firebase first, then MCP bearer → `mcp-bot`; the §4 side capability
 // namespaces MCP callers into `mcp-bot:<speakAs>` so per-side legality
 // (author-only GROUNDS / non-author WHY) is computed for the intended side.
 // Anonymous callers stay null (unchanged behaviour).
 const actorBase = await resolveCitationCallerUserId(req).catch(() => null);
 const actorId = actorBase
   ? namespaceForSpeakAs({ isMcpBearer: isMcpBearer(req), baseUserId: actorBase, speakAs })
   : null;

  // Fetch CQ text for open CQs to enhance labels
  const cqTextMap = new Map<string, string>();
  if (openKeys.length > 0 && targetType === 'claim') {
    const instances = await prisma.schemeInstance.findMany({
      where: { targetType: 'claim', targetId },
      select: { scheme: { select: { key: true, cq: true } } },
    });
    
    instances.forEach((inst) => {
      const cqArray = Array.isArray(inst.scheme?.cq) ? inst.scheme.cq : [];
      cqArray.forEach((cq: any) => {
        if (cq.key && cq.text) {
          cqTextMap.set(cq.key, cq.text);
        }
      });
    });
  }

  // Has surrender?
  // const lastTerminator = await prisma.dialogueMove.findFirst({
  //   where: {
  //     deliberationId, targetType, targetId,
  //     OR: [
  //       { kind:'CLOSE', ...(locusPath ? { payload: { path:['locusPath'], equals: locusPath } } : {}) },
  //       { kind:'ASSERT', payload: { path:['as'], equals: 'CONCEDE' } }, // CONCEDE normalized to ASSERT+as
  //     ],
  //   },
  //   orderBy: { createdAt: 'desc' },
  //   select: { id:true, kind:true, createdAt:true }
  // });
  // const isClosed = !!lastTerminator;
   const isClosed = !!lastTerminator;

  //const moves: Move[] = [];
    const moves: MoveWithVerdict[] = [];


  // GROUNDS for each open CQ — only author answers (unless testing mode)
  for (const k of openKeys) {
    const disabled = TESTING_MODE ? false : !!(actorId && targetAuthorId && actorId !== String(targetAuthorId));
    const cqText = cqTextMap.get(k) || null;
    
    moves.push({
      kind: 'GROUNDS',
      label: `Answer ${k}`,
      payload: { cqId: k, locusPath: locusPath || '0' },
      disabled,
      reason: disabled ? 'Only the author may answer this WHY' : undefined,
       verdict: disabled
       ? { code: 'R4_ROLE_GUARD', context: { cqKey: k, cqText } }
       : { code: 'R2_OPEN_CQ_SATISFIED', context: { cqKey: k, cqText } }
    });
   
  }
  
  // Generic WHY - only available if there are no open WHY moves
  // (Prevents multiple simultaneous challenges)
  // Also: cannot challenge your own item (unless testing mode)
  if (openKeys.length === 0) {
    const isOwnItem = !!(actorId && targetAuthorId && actorId === String(targetAuthorId));
    const disabled = TESTING_MODE ? false : isOwnItem;
    
    moves.push({
      kind: 'WHY',
      label: 'Challenge',
      payload: { locusPath: locusPath || '0' },
      disabled,
      reason: disabled ? 'You cannot ask WHY on your own item' : undefined,
      verdict: disabled 
        ? { code: 'R4_ROLE_GUARD', context: { hint: 'Cannot challenge your own claim' } }
        : { code: 'H1_GENERIC_CHALLENGE', context: { hint: 'Ask a general challenge (Why should we accept this?)' } }
    });
  }
  
  // Structural (Phase-2+) – offer once, not per CQ
  moves.push({ kind:'THEREFORE', label:'Therefore…', payload:{ locusPath: locusPath || '0' } });
  moves.push({ kind:'SUPPOSE',   label:'Suppose…',   payload:{ locusPath: locusPath || '0' } });
  
  // DISCHARGE: only enabled if there's an open SUPPOSE at this locus
  const openSuppose = await prisma.dialogueMove.findFirst({
    where: {
      deliberationId,
      targetType,
      targetId,
      kind: 'SUPPOSE',
      payload: { path: ['locusPath'], equals: locusPath || '0' }
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true }
  }).catch(() => null);

  let hasOpenSuppose = false;
  if (openSuppose) {
    // Check if already discharged
    const matchingDischarge = await prisma.dialogueMove.findFirst({
      where: {
        deliberationId,
        targetType,
        targetId,
        kind: 'DISCHARGE',
        payload: { path: ['locusPath'], equals: locusPath || '0' },
        createdAt: { gt: openSuppose.createdAt }
      },
      select: { id: true }
    }).catch(() => null);
    hasOpenSuppose = !matchingDischarge;
  }

  moves.push({ 
    kind:'DISCHARGE', 
    label:'Discharge',  
    payload:{ locusPath: locusPath || '0' },
    disabled: !hasOpenSuppose,
    reason: hasOpenSuppose ? undefined : 'No open SUPPOSE at this locus',
    verdict: hasOpenSuppose 
      ? { code: 'H1_OPEN_SUPPOSE', context: { locusPath: locusPath || '0' } }
      : { code: 'R8_NO_OPEN_SUPPOSE', context: { locusPath: locusPath || '0' } }
  });
 
  // WHY moves are ONLY offered through CriticalQuestions component with proper cqId
  // Generic WHY without cqId is no longer supported (causes malformed moves)
  // Users should use AttackMenuPro for structural attacks or CriticalQuestions for scheme-specific WHY

  // Concede / Retract (server will enforce invariants on POST)
  // — If claim has been answered by GROUNDS, hint to concede the *argument*
  if (targetType === 'claim' && anyGrounds) {
    const args = await prisma.argument.findMany({
      where: { deliberationId, conclusionClaimId: targetId },
      orderBy: { createdAt: 'desc' },
      select: { id:true }
    });
    if (args.length) {
    moves.push({
       kind: 'ASSERT',
        label: 'Accept argument',
        postAs: { targetType: 'argument', targetId: args[0].id },
        payload: { locusPath: locusPath || '0', as: 'ACCEPT_ARGUMENT' },
        verdict: { code: 'R7_ACCEPT_ARGUMENT', context:{ argumentId: args[0].id } }
      });
    }
  } else {
    moves.push({ kind:'CONCEDE', label:'Concede', payload: { locusPath: locusPath || '0' }});
  }
  moves.push({ kind:'RETRACT', label:'Retract', payload: { locusPath: locusPath || '0' } });



  // † when closable at locus
  if (locusPath) {
    const designs = await prisma.ludicDesign.findMany({
      where: { deliberationId },
      orderBy: [{ participantId: 'asc' }, { id: 'asc' }],
      select: { id:true, participantId:true },
    });
    const pos = designs.find(d => d.participantId === 'Proponent') ?? designs[0];
    const neg = designs.find(d => d.participantId === 'Opponent')  ?? designs[1] ?? designs[0];
    if (pos && neg) {
      const trace = await stepInteraction({
        dialogueId: deliberationId,
        posDesignId: pos.id, negDesignId: neg.id,
        phase: 'neutral', maxPairs: 256,
      }).catch(() => null);
      const closable = new Set(trace?.daimonHints?.map((h:any) => h.locusPath) ?? []);
      if (closable.has(locusPath)) {
        moves.push({ kind: 'CLOSE', label: 'Close (†)', verdict: { code: 'H2_CLOSABLE', context: { locusPath } }
, payload: { locusPath } });
      }
    }
  }

  // annotate force + soft relevance + disable ATTACK on closed
  for (const m of moves) {
    m.force =
      (m.kind === 'WHY' || m.kind === 'GROUNDS') ? 'ATTACK' :
      (m.kind === 'CONCEDE' || m.kind === 'RETRACT' || m.kind === 'CLOSE') ? 'SURRENDER' : 'NEUTRAL';
    m.relevance = m.force === 'ATTACK' ? (isClosed ? 'unlikely' : 'likely') : null;
    if (isClosed && m.force === 'ATTACK') { m.disabled = true; m.reason = 'This branch is already closed.';
      m.verdict = { code: 'R5_AFTER_SURRENDER', context: { locusPath } };
     }
  }

  return NextResponse.json({ ok:true, moves }, { headers: { 'Cache-Control': 'no-store' } });
}
