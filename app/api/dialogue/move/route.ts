export const dynamic = "force-dynamic";

// app/api/dialogue/move/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import crypto from "crypto";
import { resolveCitationCallerUserId, isMcpBearer, namespaceForSpeakAs } from '@/lib/citation/mcpAuth';
import { rateLimit } from '@/lib/rateLimit';
import { computeLegalMoves } from '@/lib/dialogue/legalMovesServer';
import { TargetType } from '@prisma/client';
import { compileFromMoves } from '@/packages/ludics-engine/compileFromMoves';
import { syncLudicsToAif } from '@/lib/ludics/syncToAif';
import { createDialogueMove } from '@/lib/ludics/createDialogueMove';
import { normalizeCoordinates } from '@/lib/provenance/coordinates';
import { invalidateInsightsCache } from '@/lib/ludics/insightsCache';
import { stepInteraction } from '@/packages/ludics-engine/stepper';
import type { MovePayload, DialogueAct } from '@/packages/ludics-core/types';
import { validateMove } from '@/lib/dialogue/validate';
import { codeHelp } from '@/lib/dialogue/codes';
 import { onDialogueMove } from '@/lib/issues/hooks';
import type { MoveKind } from '@/lib/dialogue/types';
import { emitBus } from '@/lib/server/bus'; // ✅ use the helper only
import { invalidateCommitmentStoresCache, getCommitmentStores } from '@/lib/aif/graph-builder';
import { checkNewCommitmentContradictions, type Contradiction } from '@/lib/aif/dialogue-contradictions';
import { recordAiDraftEngagement } from '@/lib/argument/aiAuthoring';
import { onDialogueMoveForObligations } from '@/lib/schemes/protocol/dialogueHooks';
import { enqueueLudicsCompile } from '@/lib/ludics/compileQueue';

function sig(s: string) { return crypto.createHash("sha1").update(s, "utf8").digest("hex"); }
const WHY_TTL_HOURS = 24;

/**
 * Map move kind to illocution (speech act type)
 */
function getIllocution(kind: string): 'Assert' | 'Question' | 'Argue' | 'Concede' | 'Retract' | 'Close' | 'Accept' | 'Suppose' | 'Discharge'  {
  switch (kind) {
    case 'WHY':
      return 'Question';
    case 'GROUNDS':
    case 'THEREFORE':
      return 'Argue';
    case 'CONCEDE':
      return 'Concede';
    case 'RETRACT':
      return 'Retract';
    case 'CLOSE':
      return 'Close';
    case 'ACCEPT_ARGUMENT':
      return 'Accept';
    case 'ASSERT':
      return 'Assert';
    case 'SUPPOSE':
      return 'Suppose';
    case 'DISCHARGE':
      return 'Discharge';
    default:
      return 'Assert';
  }
}

/**
 * Create an AIF Argument node from a GROUNDS response.
 * This makes GROUNDS a first-class argument that can be attacked/defended.
 */
async function createArgumentFromGrounds(payload: {
  deliberationId: string;
  targetClaimId: string;
  authorId: string;
  groundsText: string;
  cqId: string;
  schemeKey?: string;
}): Promise<string | null> {
  try {
    // Look up scheme ID if schemeKey is provided
    let schemeId: string | null = null;
    if (payload.schemeKey) {
      const schemeRow = await prisma.argumentScheme.findFirst({
        where: { key: payload.schemeKey },
        select: { id: true }
      });
      schemeId = schemeRow?.id ?? null;
    }

    // Create argument node
    const arg = await prisma.argument.create({
      data: {
        deliberationId: payload.deliberationId,
        authorId: payload.authorId,
        text: payload.groundsText,
        conclusionClaimId: payload.targetClaimId,
        schemeId,
        mediaType: 'text',
      }
    });

    console.log('[createArgumentFromGrounds] Created argument:', {
      argId: arg.id,
      cqId: payload.cqId,
      schemeKey: payload.schemeKey
    });

    return arg.id;
  } catch (e) {
    console.error('[createArgumentFromGrounds] Failed:', e);
    return null;
  }
}

const Body = z.object({
  deliberationId: z.string().min(1),
  targetType: z.enum(['argument','claim','card']),
  targetId: z.string().min(1),
 kind: z.enum(['ASSERT','WHY','GROUNDS','RETRACT','CONCEDE','CLOSE','THEREFORE','SUPPOSE','DISCHARGE',"ACCEPT_ARGUMENT"]),
  payload: z.any().optional(),
  postAs: z.object({
    targetType: z.enum(['argument','claim','card']),
    targetId: z.string().min(1),
  }).optional(),
  autoCompile: z.boolean().optional().default(true),
  autoStep: z.boolean().optional().default(true),
  phase: z.enum(['focus-P','focus-O','neutral']).optional().default('neutral'),
  replyToMoveId: z.string().optional(),
  replyTarget: z.enum(['claim','argument','premise','link','presupposition']).optional(),
  // Dialogical-side capability (§4). MCP-bearer only: namespaces the mover into
  // `mcp-bot:<speakAs>` so two agent sides satisfy R3_SELF_REPLY / author-only
  // GROUNDS and keep per-side commitments; ignored for cookie callers.
  speakAs: z.string().min(1).max(64).optional(),
  // N-1 (decorrelated-gating capture): raw independence coordinates supplied by
  // the calling agent/harness. Normalised + persisted as ActProvenance.
  coordinates: z.any().optional(),
 });


function cqKey(p: any) {
  const key = p?.cqId;
  if (!key) {
    console.warn('[dialogue/move] Payload missing cqId, using fallback:', { cqId: p?.cqId, schemeKey: p?.schemeKey });
    return p?.schemeKey ?? 'unknown';
  }
  return String(key);
}
function hashExpr(s?: string) { if (!s) return '∅'; let h=0; for (let i=0;i<s.length;i++) h=((h<<5)-h)+s.charCodeAt(i)|0; return String(h); }
// function makeSignature(kind: string, targetType: string, targetId: string, payload: any) {
//   if (kind === 'WHY') return ['WHY', targetType, targetId, cqKey(payload)].join(':');
//   if (kind === 'GROUNDS') {
//     const key = cqKey(payload);
//     const locus = String(payload?.locusPath ?? '');
//     const child = String(payload?.childSuffix ?? '');
//     const hexpr = hashExpr(String(payload?.expression ?? payload?.text ?? payload?.note ?? ''));
//     return ['GROUNDS', targetType, targetId, key, locus, child, hexpr].join(':');
//   }
//   if (kind === 'ASSERT' && payload?.as === 'CONCEDE') {
//     return ['CONCEDE', targetType, targetId, hashExpr(String(payload?.expression ?? payload?.text ?? ''))].join(':');
//   }
//   if (kind === 'CLOSE') {
//     const locus = String(payload?.locusPath ?? '0');
//     return ['CLOSE', targetType, targetId, locus].join(':');
//   }
//   return [kind, targetType, targetId, Date.now().toString(36), Math.random().toString(36).slice(2,8)].join(':');
// }

function synthesizeActs(kind: string, payload: any): DialogueAct[] {
  const locus = String(payload?.locusPath ?? '0');
  const expr  = String(payload?.expression ?? payload?.brief ?? payload?.note ?? '').slice(0, 2000);

  if (kind === 'WHY')     return [{ polarity:'neg', locusPath:locus, openings:[], expression: expr }];
   if (kind === 'THEREFORE') return [{ polarity:'pos', locusPath:locus, openings:[], expression: expr, additive:false }];
 if (kind === 'SUPPOSE')   return [{ polarity:'pos', locusPath:locus, openings:[], expression: expr || '+supposition', additive:false }];
 if (kind === 'DISCHARGE') return [{ polarity:'pos', locusPath:locus, openings:[], expression: 'discharge', additive:false }];
  if (kind === 'GROUNDS') return [{ polarity:'pos', locusPath:locus, openings:[], expression: expr, additive:false }];
  if (payload?.as === 'CONCEDE') // 👈 key off marker, not kind
    return [{ polarity:'pos', locusPath:locus, openings:[], expression: expr || 'conceded' }];
      if (kind === 'ACCEPT_ARGUMENT')   return [{ polarity:'daimon', locusPath:locus, openings:[], expression:'†' }];

  if (kind === 'CLOSE')   return [{ polarity:'daimon', locusPath:locus, openings:[], expression:'†' }];
  return [{ polarity:'pos', locusPath:locus, openings:[], expression: expr }];
}

function makeSignature(kind: string, targetType: string, targetId: string, payload: any) {
  if (kind === 'WHY') return ['WHY', targetType, targetId, cqKey(payload)].join(':');
   if (kind === 'THEREFORE') return ['THEREFORE', targetType, targetId, String(payload?.locusPath ?? '0'), hashExpr(String(payload?.expression ?? ''))].join(':');
 if (kind === 'SUPPOSE')   return ['SUPPOSE', targetType, targetId, String(payload?.locusPath ?? '0'), hashExpr(String(payload?.expression ?? ''))].join(':');
 if (kind === 'DISCHARGE') return ['DISCHARGE', targetType, targetId, String(payload?.locusPath ?? '0')].join(':');
 if (kind === 'ACCEPT_ARGUMENT') return ['ACCEPT_ARGUMENT', targetType, targetId, String(payload?.locusPath ?? '0')].join(':');

  if (kind === 'GROUNDS') {
    const key = cqKey(payload);
    const locus = String(payload?.locusPath ?? '');
    const child = String(payload?.childSuffix ?? '');
    const hexpr = hashExpr(String(payload?.expression ?? payload?.text ?? payload?.note ?? ''));
    return ['GROUNDS', targetType, targetId, key, locus, child, hexpr].join(':');
  }
  if (payload?.as === 'CONCEDE') { // 👈 again, use the marker
    return ['CONCEDE', targetType, targetId, hashExpr(String(payload?.expression ?? payload?.text ?? ''))].join(':');
  }
  if (kind === 'CLOSE') {
    const locus = String(payload?.locusPath ?? '0');
    return ['CLOSE', targetType, targetId, locus].join(':');
  }
  return [kind, targetType, targetId, Date.now().toString(36), Math.random().toString(36).slice(2,8)].join(':');
}


export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // let { deliberationId, targetType, targetId, kind, payload, autoCompile, autoStep, phase } = parsed.data;
//  let { deliberationId, targetType, targetId, kind, payload, autoCompile, autoStep, phase, replyToMoveId, replyTarget } = parsed.data;

  // normalize payload object + clamp + locus


// Auth: cookie/Firebase first, then MCP shared-secret bearer (so the MCP
// `post_dialogue_move` tool can post as `mcp-bot`). The §4 side capability then
// namespaces the actor into `mcp-bot:<speakAs>` — MCP-bearer only.
const baseUserId = await resolveCitationCallerUserId(req);
if (!baseUserId) return NextResponse.json({ error:'Unauthorized' }, { status: 401 });
  let { deliberationId, targetType, targetId, kind, payload, postAs, autoCompile, autoStep, phase, replyToMoveId, replyTarget, speakAs, coordinates } = parsed.data;
const mcp = isMcpBearer(req);
const userId = namespaceForSpeakAs({ isMcpBearer: mcp, baseUserId, speakAs });

// Rate limit MCP-bearer moves only (Q6: 30/h). Cookie callers are unaffected.
if (mcp) {
  const ok = await rateLimit(baseUserId, { max: 30, window: "1 h" }, "rl:mcp_move");
  if (!ok) return NextResponse.json(
    { ok: false, error: "Rate limit exceeded — max 30 MCP dialogue moves per hour", code: "MOVE_RATE_LIMITED" },
    { status: 429 },
  );
}



  if (!payload || typeof payload !== 'object') payload = {};
  ['expression','brief','note'].forEach((k) => {
    if (typeof payload[k] === 'string') payload[k] = payload[k].slice(0, 2000);
  });
  if (typeof payload.locusPath === 'string') {
    payload.locusPath = payload.locusPath.trim() || '0';
  }
  if (kind === 'GROUNDS' && !payload.locusPath) payload.locusPath = '0';

  // For WHY without cqId, generate a generic one
  if (kind === 'WHY' && !payload.cqId) {
    payload.cqId = `generic_why_${Date.now()}`;
    payload.schemeKey = 'generic_challenge';
  }

  // GROUNDS requires matching WHY with cqId
  if (kind === 'GROUNDS' && !payload.cqId) {
    return NextResponse.json({
      error: 'cqId required for GROUNDS moves',
      received: payload,
      hint: 'GROUNDS must answer a specific WHY move. Include payload.cqId to match the WHY.'
    }, { status: 400 });
  }

  // Phase 3d (dialogue-UI polish) — when the targeted CQ is flagged
  // `requiresEvidence`, both WHY and GROUNDS must carry at least one
  // evidence ref. Synthetic generic_why_* ids (used for unkeyed WHY
  // moves) are skipped because they do not correspond to a stored CQ.
  if (
    (kind === 'WHY' || kind === 'GROUNDS') &&
    typeof payload.cqId === 'string' &&
    payload.cqId &&
    !payload.cqId.startsWith('generic_why_')
  ) {
    try {
      const cq = await prisma.criticalQuestion.findUnique({
        where: { id: payload.cqId },
        select: { requiresEvidence: true },
      });
      if (cq?.requiresEvidence) {
        const refs = Array.isArray(payload.evidenceRefs)
          ? (payload.evidenceRefs as unknown[]).filter(
              (x): x is string => typeof x === 'string' && x.trim().length > 0
            )
          : [];
        if (refs.length === 0) {
          return NextResponse.json(
            {
              error: 'EVIDENCE_REQUIRED',
              hint: 'This critical question requires at least one evidence reference (payload.evidenceRefs: string[]).',
              cqId: payload.cqId,
            },
            { status: 400 }
          );
        }
        // Normalise to filtered array so downstream sees a clean shape.
        payload.evidenceRefs = refs;
      }
    } catch (err) {
      console.warn('[dialogue/move] requiresEvidence lookup failed (non-fatal):', err);
    }
  }
  
  // Validate expression for structural moves
  if ((kind === 'THEREFORE' || kind === 'SUPPOSE') && !payload.expression) {
    return NextResponse.json({
      error: 'expression required for THEREFORE/SUPPOSE moves',
      received: payload,
      hint: 'Include payload.expression with the text of the conclusion/supposition'
    }, { status: 400 });
  }

  const actorId = String(userId ?? 'unknown');

  // ---- Idempotency pre-flight (mirrors /api/ca) ----
  // A retry carrying the same payload.requestId replays the move that already
  // landed, BEFORE re-validating. Critical for retry-after-timeout: the first
  // (timed-out) call may have already discharged the WHY, so re-running
  // validateMove would wrongly return R2_NO_OPEN_CQ on a GROUNDS that actually
  // succeeded. Scoped to (deliberationId, actorId, requestId) so distinct sides
  // don't collide.
  const requestId = typeof (payload as any)?.requestId === 'string' ? (payload as any).requestId : null;
  if (requestId) {
    const prior = await prisma.dialogueMove.findFirst({
      where: { deliberationId, actorId, payload: { path: ['requestId'], equals: requestId } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, actorId: true, targetType: true, targetId: true, payload: true, signature: true, createdAt: true },
    });
    if (prior) {
      return NextResponse.json({ ok: true, move: prior, step: null, dedup: true, idempotentReplay: true });
    }
  }

    // ---- Protocol validator (R1…R7) ----
    const legal = await validateMove({ deliberationId, actorId, kind: kind as MoveKind, targetType, targetId, replyToMoveId, replyTarget, payload });
    if (!('ok' in legal) || !legal.ok) {
      // Structured R-code surface (contract for MCP optimistic-write, Q5):
      // callers get a single stable `code` + human message alongside the
      // existing `reasonCodes` array (kept for backward-compat with the web UI).
      const primary = legal.reasons[0];
      // R7 asks the caller to ACCEPT_ARGUMENT the argument rather than CONCEDE
      // the claim — echo the postAs target so the caller can retry correctly.
      let postAsHint: { targetType: string; targetId: string } | undefined;
      if (legal.reasons.includes('R7_ACCEPT_ARGUMENT_REQUIRED')) {
        try {
          const hintMoves = await computeLegalMoves({
            deliberationId, targetType, targetId,
            locusPath: payload?.locusPath ?? '0', actorId,
          });
          const accept = hintMoves.moves.find(m => m.kind === 'ACCEPT_ARGUMENT' && m.postAs);
          if (accept?.postAs) postAsHint = accept.postAs;
        } catch { /* hint is best-effort */ }
      }
      return NextResponse.json({
        ok: false,
        error: codeHelp[primary as keyof typeof codeHelp] ?? primary,
        code: primary,
        reasonCodes: legal.reasons,
        ...(postAsHint ? { postAs: postAsHint } : {}),
      }, { status: 409 });
    }

// Enforce allowed shape (R4/R5/R7)
const allowed = await computeLegalMoves({
  deliberationId, targetType, targetId, locusPath: payload?.locusPath ?? '0', actorId
});

const allowedActive = allowed.moves.filter(m => !m.disabled);
const ok = allowedActive.some(m => {
  const kindOk = m.kind === kind;
  const locusOk = !m.payload?.locusPath || m.payload.locusPath === (payload?.locusPath ?? '0');
  const cqOk = !m.payload?.cqId || m.payload.cqId === (payload?.cqId ?? payload?.schemeKey);
  // Check postAs: if legal move specifies postAs, request must match it
  const postAsOk = !m.postAs || (
    postAs && 
    m.postAs.targetType === postAs.targetType && 
    m.postAs.targetId === postAs.targetId
  );
  // Also check payload.as for ACCEPT_ARGUMENT and similar markers
  const payloadAsOk = !m.payload?.as || m.payload.as === payload?.as;
  return kindOk && locusOk && cqOk && postAsOk && payloadAsOk;
});

if (!ok) {
  // The requested kind is not in the active legal set. If it appears as a
  // *disabled* move, relay its specific reason so the caller can correct
  // (Q5 optimistic-write contract); otherwise fall back to the generic code.
  const disabledMatch = allowed.moves.find(m => m.kind === kind && m.disabled);
  return NextResponse.json({
    error: disabledMatch?.reason ?? 'MOVE_ILLEGAL',
    code: 'MOVE_ILLEGAL',
    reason: disabledMatch?.reason,
    details: allowed,
  }, { status: 400 });
}

  // optional: verify target belongs to deliberation
  try {
    if (targetType === 'argument') {
      const ok = await prisma.argument.findFirst({ where: { id: targetId, deliberationId }, select: { id:true } });
      if (!ok) return NextResponse.json({ error:'TARGET_MISMATCH' }, { status: 400 });
    } else if (targetType === 'claim') {
      const ok = await prisma.claim.findFirst({ where: { id: targetId, deliberationId }, select: { id:true } });
      if (!ok) return NextResponse.json({ error:'TARGET_MISMATCH' }, { status: 400 });
    } else if (targetType === 'card') {
      const ok = await prisma.deliberationCard.findFirst({ where: { id: targetId, deliberationId }, select: { id: true } });
      if (!ok) return NextResponse.json({ error:'TARGET_MISMATCH' }, { status: 400 });
    }
  } catch {}

  // map CONCEDE to ASSERT + marker (compat)
const originalKind = kind;
if (originalKind === 'CONCEDE') { kind = 'ASSERT'; payload = { ...(payload ?? {}), as: 'CONCEDE' }; }
// NEW: map ACCEPT_ARGUMENT
if (originalKind === 'ASSERT' && payload?.as === 'ACCEPT_ARGUMENT') {
  // keep as ASSERT with marker; we’ll update acceptance ledger below
}
const wasConcede = originalKind === 'CONCEDE' || payload?.as === 'CONCEDE';
const wasAccept  = payload?.as === 'ACCEPT_ARGUMENT';

  // ---- CQStatus integration for WHY / GROUNDS ----
try {
  const schemeKey = String(payload?.cqId ?? payload?.schemeKey ?? '');
  if (kind === 'WHY' && schemeKey) {
    await prisma.cQStatus.upsert({
      where: { targetType_targetId_schemeKey_cqKey: { targetType: 'argument' as TargetType, targetId, schemeKey, cqKey: schemeKey } },
      create: { targetType: 'argument' as TargetType, targetId, argumentId: targetType === 'argument' ? targetId : null,
                status: 'open', schemeKey, cqKey: schemeKey, satisfied: false, createdById: actorId },
      update: { status: 'open', satisfied: false },
    });
  } else if (kind === 'GROUNDS' && schemeKey) {
    const groundsText = String(payload?.expression ?? payload?.brief ?? payload?.note ?? '').trim();

    // Create AIF argument node from GROUNDS if we have substantial content
    if (groundsText && groundsText.length > 5 && targetType === 'claim') {
      const argId = await createArgumentFromGrounds({
        deliberationId,
        targetClaimId: targetId,
        authorId: actorId,
        groundsText,
        cqId: schemeKey,
        schemeKey: payload?.schemeKey,
      });

      // Store argId in move payload for reference
      if (argId) {
        (payload as any).createdArgumentId = argId;
      }
    }

    await prisma.cQStatus.updateMany({
      where: { targetType: 'argument' as TargetType, targetId, schemeKey, cqKey: schemeKey },
      data: { status: 'answered', satisfied: true },
    });
  } else if (kind === 'GROUNDS' && !schemeKey) {
    // Handle GROUNDS moves without explicit CQ/scheme (e.g., generic grounds)
    const groundsText = String(payload?.expression ?? payload?.brief ?? payload?.note ?? '').trim();
    
    if (groundsText && groundsText.length > 5 && targetType === 'claim') {
      const argId = await createArgumentFromGrounds({
        deliberationId,
        targetClaimId: targetId,
        authorId: actorId,
        groundsText,
        cqId: 'generic_grounds',
        schemeKey: undefined,
      });

      // Store argId in move payload for reference
      if (argId) {
        (payload as any).createdArgumentId = argId;
      }
    }
  }
} catch (err) {
  console.error('[dialogue/move] CQStatus/GROUNDS integration error:', err);
}

  // WHY TTL
  if (kind === 'WHY') {
    const d = new Date(); d.setHours(d.getHours() + WHY_TTL_HOURS);
    payload = { ...(payload ?? {}), deadlineAt: payload?.deadlineAt || d.toISOString() };
  }

  // Ensure acts
  const acts = Array.isArray(payload?.acts) && payload.acts.length ? payload.acts : synthesizeActs(kind, payload);
  (payload as MovePayload).acts = acts;


  // If postAs is provided, use it as the actual target (e.g., ACCEPT_ARGUMENT posts to argument, not claim)
  const actualTargetType = postAs?.targetType ?? targetType;
  const actualTargetId = postAs?.targetId ?? targetId;

  // signature (use actual target for signature generation)
  const signature = makeSignature(kind, actualTargetType, actualTargetId, payload);

  // map kind to illocution (speech act type)
  const illocution = getIllocution(kind);

  // Extract argumentId for GROUNDS moves (before try block so it's in scope)
  const argumentIdForGrounds = (kind === 'GROUNDS' && targetType === 'argument') 
    ? targetId 
    : (kind === 'GROUNDS' && payload?.createdArgumentId) 
      ? payload.createdArgumentId 
      : undefined;

  // H1 seam: writes DialogueMove + AIF graph (for argument targets) +
  // substrate LudicMove + WitnessRecord in a single transaction, with
  // P2002 dedup on (deliberationId, signature). See
  // lib/ludics/createDialogueMove.ts.
  const seamResult = await createDialogueMove({
    deliberationId,
    targetType: actualTargetType,
    targetId: actualTargetId,
    kind,
    illocution,
    payload,
    actorId,
    signature,
    replyToMoveId,
    replyTarget,
    argumentId: argumentIdForGrounds,
    locusPath: typeof (payload as any)?.locusPath === 'string'
      ? (payload as any).locusPath
      : null,
    // N-1: attach independence coordinates; capturedVia reflects the caller.
    provenance: {
      ...(normalizeCoordinates(coordinates) ?? {}),
      capturedVia: mcp ? 'mcp' : 'ui',
    },
  }, {
    // Record-only for MCP: skip the in-transaction AIF graph sync
    // (syncArgumentToAif fires 7 findMany + per-node/edge upserts for an
    // argument target — the residual 15-60s cost after compile was deferred).
    // Like the ludics compile, the AIF view is derived and not needed
    // synchronously by the dialectic tools. Web/cookie callers keep it.
    syncAif: !mcp,
  });
  const move: any = seamResult.move;
  const dedup = seamResult.deduplicated;

  // AI-EPI Pt. 4 §8 — record human engagement against AI-authored arguments.
  // Fire-and-forget; helper short-circuits on human targets and self-engagement.
  if (!dedup && actualTargetType === 'argument') {
    const engagementKind =
      kind === 'GROUNDS' ? 'cqAnswer'
      : kind === 'WHY' ? 'attack'
      : (wasConcede || wasAccept) ? 'concede'
      : kind === 'ASSERT' ? 'support'
      : null;
    if (engagementKind) {
      void recordAiDraftEngagement({
        argumentId: actualTargetId,
        actorAuthId: String(actorId),
        kind: engagementKind,
      });
    }
  }

  // ✨ PHASE 1: Link Argument back to GROUNDS move that created it
  // This completes bidirectional dialogue provenance: GROUNDS ↔ Argument
  if (move && kind === 'GROUNDS' && argumentIdForGrounds && !dedup) {
    try {
      await prisma.argument.update({
        where: { id: argumentIdForGrounds },
        data: { createdByMoveId: move.id },
      });
      console.log('[dialogue/move] Linked Argument to GROUNDS move:', {
        argumentId: argumentIdForGrounds,
        moveId: move.id,
      });
    } catch (err) {
      console.error('[dialogue/move] Failed to link Argument to GROUNDS move:', err);
      // Don't fail the whole request
    }
  }

  // after creating `move`:
  async function resolveProposition(): Promise<string | null> {
    try {
      if (actualTargetType === 'claim') {
        const c = await prisma.claim.findUnique({ where: { id: actualTargetId }, select: { text:true } });
        if (c?.text) return c.text;
      } else if (actualTargetType === 'argument') {
        const a = await prisma.argument.findUnique({ where: { id: actualTargetId }, select: { text:true } });
        if (a?.text) return a.text;
      }
    } catch {}
    const expr = String(payload?.expression ?? payload?.brief ?? payload?.note ?? '').trim();
    return expr || null;
  }

  const prop = await resolveProposition();

// ✨ PHASE 4: Contradiction detection for commitment-creating moves.
// Fires on a bare ASSERT (all callers, existing behaviour) and — per Q4 of the
// ATTACKS_AND_DIALOGUE_MOVES_OVER_MCP spec — on an MCP CONCEDE, which is itself a
// commitment-creating move (CONCEDE upserts a Commitment below). Gated to the MCP
// bearer so the human web UI's CONCEDE flow (with its own bypass UX) is unchanged;
// the MCP surface never exposes bypassContradictionCheck, so a contradiction is
// surfaced and the write refused.
let detectedContradictions: Contradiction[] = [];
const isBareAssert = kind === 'ASSERT' && !wasConcede && !wasAccept;
const isMcpConcede = mcp && wasConcede;
if (prop && (isBareAssert || isMcpConcede)) {
  try {
    // Get existing commitments for this participant
    const storesResult = await getCommitmentStores(deliberationId);
    if (storesResult && 'data' in storesResult && Array.isArray(storesResult.data)) {
      const participantStore = storesResult.data.find(s => s.participantId === actorId);
      if (participantStore) {
        // Convert to simple commitment records
        const existingCommitments = participantStore.commitments
          .filter(c => c.isActive) // Only active commitments
          .map(c => ({
            claimId: c.claimId,
            claimText: c.claimText,
            moveId: c.moveId,
            moveKind: c.moveKind,
            timestamp: new Date(c.timestamp),
            isActive: true,
          }));
        
        // Check for contradictions with new claim
        detectedContradictions = checkNewCommitmentContradictions(prop, existingCommitments);
        
        // If contradictions found AND bypassContradictionCheck is not set, return them
        if (detectedContradictions.length > 0 && !payload?.bypassContradictionCheck) {
          return NextResponse.json({
            ok: false,
            error: 'CONTRADICTION_DETECTED',
            contradictions: detectedContradictions,
            newCommitment: {
              text: prop,
              targetId: actualTargetId,
              targetType: actualTargetType,
            },
            message: `This claim contradicts ${detectedContradictions.length} of your existing commitments.`,
          }, { status: 409 });
        }
      }
    }
  } catch (error) {
    console.error('[dialogue/move] Contradiction check failed:', error);
    // Don't block the move if contradiction check fails
  }
}

if (prop) {
  if (wasConcede) {
    await prisma.commitment.upsert({
      where: { deliberationId_participantId_proposition: { deliberationId, participantId: actorId, proposition: prop } },
      update: { isRetracted: false },
      create: { deliberationId, participantId: actorId, proposition: prop, isRetracted: false },
    }).catch(() => {});
    emitBus("dialogue:cs:refresh", { deliberationId, participantId: actorId });
  }
  if (wasAccept) {
    // Mark acceptance of the *argument* (or its proposition) — simple ledger reuse via commitment
    await prisma.commitment.upsert({
      where: { deliberationId_participantId_proposition: { deliberationId, participantId: actorId, proposition: `ACCEPT:${prop}` } },
      update: { isRetracted: false },
      create: { deliberationId, participantId: actorId, proposition: `ACCEPT:${prop}`, isRetracted: false },
    }).catch(()=>{});
    emitBus("dialogue:cs:refresh", { deliberationId, participantId: actorId });
  }
  if (kind === 'RETRACT') {
    await prisma.commitment.updateMany({
      where: { deliberationId, participantId: actorId, proposition: prop, isRetracted: false },
      data: { isRetracted: true },
    }).catch(() => {});
    emitBus("dialogue:cs:refresh", { deliberationId, participantId: actorId });
  }
}

  // ✨ PHASE 1: Auto-create ConflictApplication when WHY move targets an argument
  // This completes bidirectional sync: WHY ↔ ConflictApplication
  if (kind === 'WHY' && targetType === 'argument' && move && !payload?.conflictApplicationId) {
    try {
      // Determine attack type from payload or default to REBUTS
      const attackType = (payload?.attackType === 'UNDERCUTS' || payload?.attackType === 'UNDERMINES') 
        ? payload.attackType 
        : 'REBUTS';
      
      const ca = await prisma.conflictApplication.create({
        data: {
          deliberationId,
          conflictingArgumentId: null, // WHY doesn't specify attacking argument yet
          conflictedArgumentId: targetId,
          legacyAttackType: attackType,
          createdById: actorId,
          createdByMoveId: move.id, // 👈 Link to dialogue move (Phase 1 dialogue provenance)
          metaJson: {
            dialogueMoveId: move.id, // Link back to WHY move
            cqId: payload?.cqId,
            expression: payload?.expression,
          },
        },
      });

      console.log('[dialogue/move] Auto-created ConflictApplication for WHY:', {
        whyMoveId: move.id,
        caId: ca.id,
        attackType,
        targetId,
      });

      // Store CA ID in move payload for reference (trace WHY → CA).
      // IMPORTANT: merge the route's in-scope `payload` (which carries cqId /
      // expression / locusPath / acts), NOT `move.payload` — createDialogueMove
      // returns the move WITHOUT selecting `payload`, so `move.payload` is
      // undefined and spreading it would CLOBBER the whole payload down to just
      // `{ conflictApplicationId }`, erasing the WHY's cqId. That made the WHY
      // key collapse to 'default' and left every GROUNDS answer failing
      // R2_NO_OPEN_CQ (the challenge was unanswerable). See DB probe in the spec.
      try {
        await prisma.dialogueMove.update({
          where: { id: move.id },
          data: {
            payload: {
              ...(payload as any),
              conflictApplicationId: ca.id,
            },
          },
        });
      } catch (err) {
        console.warn('[dialogue/move] Failed to update move with CA ID:', err);
      }
    } catch (err) {
      console.error('[dialogue/move] Failed to auto-create ConflictApplication:', err);
      // Don't fail the whole request if CA creation fails
    }
  }

  // compile & step. The move is already durably committed above; the ludics
  // recompile + interaction step are best-effort consistency work. On a large
  // deliberation `compileFromMoves` can take 60s+ and blow its own transaction
  // timeout, so for MCP callers we run it in the BACKGROUND (fire-and-forget)
  // rather than making the agent wait — `step` is simply null in that response.
  // Cookie/web callers keep the synchronous behaviour (they render `step`).
  let step: any = null;
  const compileAndStep = async (): Promise<void> => {
    if (autoCompile && !(dedup && (kind === 'WHY' || kind === 'GROUNDS'))) {
      await compileFromMoves(deliberationId).catch(() => {});
      await syncLudicsToAif(deliberationId).catch((err) => {
        console.error("[ludics] Failed to sync to AIF:", err);
      });
      await invalidateInsightsCache(deliberationId).catch((err) => {
        console.error("[ludics] Failed to invalidate cache:", err);
      });
    }
    if (autoStep) {
      // Non-fatal: a committed move must never 500 because stepping failed.
      try {
        const designs = await prisma.ludicDesign.findMany({
          where: { deliberationId },
          orderBy: [{ participantId:'asc' }, { id:'asc' }],
          select: { id:true, participantId:true },
        });
        const pos = designs.find(d => d.participantId === 'Proponent') ?? designs[0];
        const neg = designs.find(d => d.participantId === 'Opponent')  ?? designs[1] ?? designs[0];
        if (pos && neg) {
          step = await stepInteraction({ dialogueId: deliberationId, posDesignId: pos.id, negDesignId: neg.id, phase, maxPairs: 1024 }).catch(() => null);
        }
      } catch (err) {
        console.error('[dialogue/move] autoStep failed (non-fatal; move already committed):', err);
        step = null;
      }
    }
  };
  // MCP moves are RECORD-ONLY: skip the ludics recompile entirely (not just
  // background it). On a large deliberation compileFromMoves takes 60-120s AND
  // holds heavy delete/recreate DB work that STARVES concurrent foreground
  // writes — their 5s interactive-transaction timeout blows, which is what
  // caused the intermittent move/CONCEDE 500s (a compile kicked off by an
  // earlier move was still running). The dialectic tools read
  // DialogueMove/CQStatus/Commitment rows written synchronously above; they do
  // not need fresh ludics designs. Web/cookie callers still compile+step.
  if (!mcp) {
    await compileAndStep();
  } else {
    // MCP: enqueue a debounced, coalesced background compile instead of doing
    // nothing (DEFERRED_LUDICS_COMPILE_ROADMAP §4.4). Fire-and-forget with a
    // `.catch` — the move is already durably committed, so a Redis hiccup must
    // never fail it; a missed enqueue just delays freshness until the next move
    // or an explicit `compile_deliberation`.
    void enqueueLudicsCompile(deliberationId).catch((err) => {
      console.error('[dialogue/move] enqueueLudicsCompile failed (non-fatal):', err);
    });
    console.log('[dialogue/move] MCP record-only: enqueued deferred ludics compile for', deliberationId);
  }

  // bus/SSE
  emitBus("dialogue:changed", { deliberationId, moveId: move?.id, kind });         // ✅ fix: move.id
  emitBus("dialogue:moves:refresh", { deliberationId });

  // Invalidate commitment stores cache (Phase 1: Critical Fixes)
  try {
    await invalidateCommitmentStoresCache(deliberationId);
  } catch (error) {
    console.error('[move] Failed to invalidate commitment stores cache:', error);
    // Don't fail the request if cache invalidation fails
  }

  try {
    await onDialogueMove({ deliberationId, targetType, targetId, kind: kind as MoveKind, payload });
    emitBus('issues:changed', { deliberationId });
  } catch {}

  // Phase 4 / Spec 3 §3.4 — record CQ-obligation transition for the move.
  // Non-fatal: hook swallows its own errors.
  if (move?.id && !dedup) {
    void onDialogueMoveForObligations({
      kind,
      payload: payload as any,
      moveId: move.id,
    });
  }

  return NextResponse.json({ 
    ok: true, 
    move, 
    step, 
    dedup,
    contradictionsBypassed: detectedContradictions.length > 0 ? detectedContradictions : undefined,
  });
}


