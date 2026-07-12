export const dynamic = "force-dynamic";

// app/api/ca/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { createDialogueMove } from '@/lib/ludics/createDialogueMove';
import { z } from 'zod';
import { resolveCitationCallerUserId, isMcpBearer, namespaceForSpeakAs } from '@/lib/citation/mcpAuth';
import { mintObjectionClaim } from '@/lib/claims/mintObjectionClaim';
import { rateLimit } from '@/lib/rateLimit';
import { TargetType } from '@prisma/client';
import { compileFromMoves } from '@/packages/ludics-engine/compileFromMoves';
import { syncLudicsToAif } from '@/lib/ludics/syncToAif';
import { invalidateInsightsCache } from '@/lib/ludics/insightsCache';
import { computeAspicConflictMetadata } from '@/lib/aspic/conflictHelpers';
import { resolveRatificationPolicy } from '@/lib/aspic/ratification/policy';
import { createRatificationNeededNotif } from '@/lib/actions/notification.actions';
import { normalizeCoordinates, writeActProvenance, writeCheckExposure } from '@/lib/provenance/coordinates';
import { enqueueLudicsCompile } from '@/lib/ludics/compileQueue';
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

const CreateCA = z.object({
  deliberationId: z.string().min(6),
  schemeKey: z.string().optional(),              // optional catalog typing
  // exactly one of these must be set for each side
  conflictingClaimId: z.string().optional(),
  conflictingArgumentId: z.string().optional(),
  conflictedClaimId: z.string().optional(),
  conflictedArgumentId: z.string().optional(),
  // optional bridge for legacy AF counts
  legacyAttackType: z.enum(['REBUTS','UNDERCUTS','UNDERMINES']).optional(),
  legacyTargetScope: z.enum(['conclusion','inference','premise']).optional(),
  // NEW: metadata for CQ tracking
  metaJson: z.record(z.any()).optional(),
  // Idempotency key for MCP callers (mirrors chain/CQ). Stored in metaJson;
  // a retry with the same key replays the first CA rather than duplicating.
  requestId: z.string().min(1).max(200).optional(),
  // Dialogical-side capability (§4). MCP-bearer only: namespaces the attacker
  // into `mcp-bot:<speakAs>`; ignored for cookie callers.
  speakAs: z.string().min(1).max(64).optional(),
  // Freestanding-attack convenience (attack_argument): when no explicit
  // conflicting{Claim,Argument}Id is given, the route mints a scheme-free
  // objection Claim from this text and uses it as the conflicting side.
  groundsText: z.string().min(10).max(5000).optional(),
  // N-1 (decorrelated-gating capture): raw independence coordinates of the
  // attacking agent/harness. Persisted as ActProvenance for the CA and as the
  // challenger coordinates on the CONTEST/ACTED CheckExposure (N-3 numerator).
  coordinates: z.any().optional(),
});

export async function POST(req: NextRequest) {
  // Auth: cookie/Firebase first, then MCP shared-secret bearer — so the
  // `attack_argument` MCP tool can file a ConflictApplication as `mcp-bot`
  // without a session cookie (S2). The route stays the single canonical
  // attack write; no parallel endpoint.
  const baseUserId = await resolveCitationCallerUserId(req);
  if (!baseUserId) return NextResponse.json({ error:'Unauthorized' }, { status:401, ...NO_STORE });

  const p = CreateCA.safeParse(await req.json().catch(()=>({})));
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status:400, ...NO_STORE });
  const d = p.data;

  // §4 side capability: namespace the attacker into `mcp-bot:<speakAs>` under an
  // MCP bearer only (human callers keep their raw id; speakAs is ignored).
  const mcp = isMcpBearer(req);
  const userId = namespaceForSpeakAs({ isMcpBearer: mcp, baseUserId, speakAs: d.speakAs });

  // Rate limit MCP-bearer attacks only (Q6: 20/h). Human UI attacks are
  // unaffected. Keyed on the bearer identity so all MCP sides share the bucket.
  if (mcp) {
    const ok = await rateLimit(baseUserId, { max: 20, window: "1 h" }, "rl:mcp_attack");
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded — max 20 MCP attacks per hour", code: "MOVE_RATE_LIMITED" },
        { status: 429, ...NO_STORE },
      );
    }
  }

  // Idempotency pre-flight (mirrors chain/CQ): a retry carrying the same
  // requestId replays the first CA rather than filing a duplicate attack.
  // Runs BEFORE any objection-claim mint so a replay never orphans a claim.
  if (d.requestId) {
    const prior = await prisma.conflictApplication.findFirst({
      where: {
        deliberationId: d.deliberationId,
        metaJson: { path: ['requestId'], equals: d.requestId },
      },
      select: { id: true, createdByMoveId: true, ratificationStatus: true, conflictingClaimId: true },
    });
    if (prior) {
      return NextResponse.json({
        ok: true,
        id: prior.id,
        conflictApplicationId: prior.id,
        attackMoveId: prior.createdByMoveId,
        ratificationStatus: prior.ratificationStatus,
        // Echo the attacker claim on replay too, so a caller whose original
        // response was lost to a timeout can still recover the (minted) objection
        // claim id instead of getting a slimmer envelope than the first call.
        objectionClaimId: prior.conflictingClaimId,
        idempotentReplay: true,
      }, NO_STORE);
    }
  }

  // attack_argument convenience: when the caller supplied objection text but no
  // explicit attacker node, mint a scheme-free objection Claim (S1 helper) and
  // use it as the conflicting side. Explicit attacker ids always win.
  let objectionClaimId: string | null = null;
  if (d.groundsText && !d.conflictingClaimId && !d.conflictingArgumentId) {
    const objection = await mintObjectionClaim({
      db: prisma,
      text: d.groundsText,
      createdById: String(userId),
      deliberationId: d.deliberationId,
      moidPrefix: "attack-objection",
    });
    objectionClaimId = objection.id;
    d.conflictingClaimId = objection.id;
  }

  const left = [d.conflictingClaimId, d.conflictingArgumentId].filter(Boolean).length;
  const right = [d.conflictedClaimId, d.conflictedArgumentId].filter(Boolean).length;
  if (left !== 1 || right !== 1) {
    return NextResponse.json({ error:'CA requires exactly one conflicting element and one conflicted element' }, { status:400, ...NO_STORE });
  }

  // resolve optional scheme
  const scheme = d.schemeKey
    ? await prisma.conflictScheme.findUnique({ where: { key: d.schemeKey }, select: { id:true, legacyAttackType:true, legacyTargetScope:true } })
    : null;

  // Compute ASPIC+ metadata
  const aspicMetadata = computeAspicConflictMetadata(
    null, // No ASPIC+ computation in this endpoint yet
    {
      attackType: (d.legacyAttackType ?? scheme?.legacyAttackType ?? 'UNDERMINES') as any,
      targetScope: (d.legacyTargetScope ?? scheme?.legacyTargetScope ?? 'premise') as any,
      cqKey: (d.metaJson as any)?.cqKey,
      schemeKey: d.schemeKey,
    },
    d.conflictingClaimId || d.conflictingArgumentId,
    d.conflictedClaimId || d.conflictedArgumentId
  );

  // Attack ratification (DEV_SPEC §3.2): under a gating policy a new CA starts
  // PROPOSED and does not count as a defeat until ratified; under `none` it is
  // EFFECTIVE immediately. The column default is EFFECTIVE, so system-generated
  // CAs (translation/import paths) need no change.
  const ratPolicy = await resolveRatificationPolicy(d.deliberationId);
  const ratGated = ratPolicy.kind !== 'none';
  const ratificationStatus = ratGated ? 'PROPOSED' : 'EFFECTIVE';

  const created = await prisma.conflictApplication.create({
    data: {
      deliberationId: d.deliberationId,
      ...(scheme?.id ? { schemeId: scheme.id } : {}),
      createdById: String(userId),
      ratificationStatus,
      ratifiedAt: ratGated ? null : new Date(),
      conflictingClaimId: d.conflictingClaimId ?? null,
      conflictingArgumentId: d.conflictingArgumentId ?? null,
      conflictedClaimId: d.conflictedClaimId ?? null,
      conflictedArgumentId: d.conflictedArgumentId ?? null,
      // legacy AF bridge (optional)
      legacyAttackType: d.legacyAttackType ?? scheme?.legacyAttackType ?? null,
      legacyTargetScope: d.legacyTargetScope ?? scheme?.legacyTargetScope ?? null,
      // NEW: CQ tracking metadata (+ optional MCP idempotency key)
      metaJson: { ...(d.metaJson ?? {}), ...(d.requestId ? { requestId: d.requestId } : {}) },
      // Phase 1d: ASPIC+ Integration
      aspicAttackType: aspicMetadata.aspicAttackType,
      aspicDefeatStatus: aspicMetadata.aspicDefeatStatus,
      aspicMetadata: aspicMetadata.aspicMetadata ?? undefined,
      // Phase 1 dialogue provenance: will be linked to ATTACK move below
      // createdByMoveId: <set after ATTACK move created>
    },
    select: { id:true }
  });

  // N-1/N-3 capture (best-effort; the CA is already committed above).
  // ActProvenance records the attacker's independence coordinates on the
  // conflict_application; the CheckExposure is a CONTEST/ACTED row — an attack
  // that DID happen (the numerator whose DECLINED complement N-3 also captures).
  {
    const coords = {
      ...(normalizeCoordinates(d.coordinates) ?? {}),
      capturedVia: (mcp ? 'mcp' : 'ui') as 'mcp' | 'ui',
    };
    await writeActProvenance(prisma, 'conflict_application', created.id, coords);
    const exposedIsArg = !!d.conflictedArgumentId;
    const exposedId = d.conflictedArgumentId ?? d.conflictedClaimId ?? null;
    if (exposedId) {
      await writeCheckExposure(prisma, {
        deliberationId: d.deliberationId,
        subjectType: exposedIsArg ? 'argument' : 'claim',
        subjectId: exposedId,
        lane: 'CONTEST',
        outcome: 'ACTED',
        agentId: String(userId),
        coords,
        resultActType: 'conflict_application',
        resultActId: created.id,
      });
    }
  }

  // Attack ratification (DEV_SPEC §7.2): when a new attack is gated (PROPOSED),
  // notify the attacked element's author that it awaits ratification. Best-effort
  // — never fail the CA create on a notification error.
  if (ratGated) {
    try {
      let targetAuthorId: string | null = null;
      if (d.conflictedArgumentId) {
        const a = await prisma.argument.findUnique({ where: { id: d.conflictedArgumentId }, select: { authorId: true } });
        targetAuthorId = a?.authorId ?? null;
      } else if (d.conflictedClaimId) {
        const c = await prisma.claim.findUnique({ where: { id: d.conflictedClaimId }, select: { createdById: true } });
        targetAuthorId = c?.createdById ?? null;
      }
      if (targetAuthorId) {
        await createRatificationNeededNotif({
          recipientUserId: targetAuthorId,
          actorUserId: String(userId),
          deliberationId: d.deliberationId,
          conflictApplicationId: created.id,
        });
      }
    } catch (err) {
      console.error('[ca] Failed to send ratification-needed notification:', err);
    }
  }

  // ✨ PHASE 1: Create ATTACK DialogueMove when AIF attack is created
  // This completes bidirectional sync: ConflictApplication ↔ ATTACK move
  let attackMoveId: string | null = null;
  try {
    const targetType = d.conflictedArgumentId ? 'argument' : 'claim';
    const targetId = d.conflictedArgumentId || d.conflictedClaimId;
    
    if (targetId) {
      // Generate expression based on attack type
      const attackLabels = {
        'REBUTS': 'I challenge this conclusion',
        'UNDERCUTS': 'I challenge the reasoning',
        'UNDERMINES': 'I challenge this premise',
      };
      const expression = attackLabels[d.legacyAttackType as keyof typeof attackLabels] || 'I challenge this';
      
      const cqId = (d.metaJson as any)?.cqId || `aif_attack_${created.id}`;
      
      // Create ATTACK move linked to this ConflictApplication via the H1 seam.
      const seamResult = await createDialogueMove({
        deliberationId: d.deliberationId,
        targetType: targetType as TargetType,
        targetId,
        kind: 'ATTACK',
        actorId: String(userId),
        payload: {
          cqId,
          schemeKey: d.schemeKey || undefined,
          locusPath: '0',
          expression: (d.metaJson as any)?.cqContext || expression,
          attackType: d.legacyAttackType,
          conflictApplicationId: created.id,
        },
        signature: `ATTACK:${targetType}:${targetId}:${cqId}:${created.id}`,
        endsWithDaimon: false,
        locusPath: '0',
      }, { syncAif: !mcp }); // record-only for MCP: defer the heavy AIF graph sync
      const attackMove = seamResult.move;
      
      attackMoveId = attackMove.id;
      
      console.log('[ca] Auto-created ATTACK move for AIF attack:', {
        attackId: created.id,
        attackMoveId: attackMove.id,
        attackType: d.legacyAttackType,
        targetType,
        targetId,
      });
      
      // Link ConflictApplication back to ATTACK move
      await prisma.conflictApplication.update({
        where: { id: created.id },
        data: { createdByMoveId: attackMove.id }, // 👈 Dialogue provenance linkage
      });
    }
  } catch (err) {
    console.error('[ca] Failed to auto-create ATTACK move:', err);
    // Don't fail the whole request if ATTACK creation fails
  }
  
  // Optional: Also create WHY move for tracking challenges (separate from ATTACK)
  // This maintains backward compatibility with existing WHY move tracking
  try {
    const targetType = d.conflictedArgumentId ? 'argument' : 'claim';
    const targetId = d.conflictedArgumentId || d.conflictedClaimId;
    
    if (targetId) {
      // Generate expression based on attack type
      const attackLabels = {
        'REBUTS': 'I challenge this conclusion',
        'UNDERCUTS': 'I challenge the reasoning',
        'UNDERMINES': 'I challenge this premise',
      };
      const expression = attackLabels[d.legacyAttackType as keyof typeof attackLabels] || 'I challenge this';
      
      // ✨ PHASE 3: Use real CQ information from metaJson if available
      const cqId = (d.metaJson as any)?.cqId || `aif_attack_${created.id}`;
      const cqText = (d.metaJson as any)?.cqText;
      const schemeKey = (d.metaJson as any)?.schemeKey;
      
      // Create WHY move linked to this attack via the H1 seam.
      await createDialogueMove({
        deliberationId: d.deliberationId,
        targetType: targetType as TargetType,
        targetId,
        kind: 'WHY',
        actorId: String(userId),
        payload: {
          cqId,
          schemeKey: schemeKey || undefined,
          locusPath: '0',
          expression: (d.metaJson as any)?.cqContext || expression,
          attackType: d.legacyAttackType,
          conflictApplicationId: created.id,
          cqText: cqText || undefined,
        },
        signature: `WHY:${targetType}:${targetId}:${cqId}`,
        locusPath: '0',
      }, { syncAif: !mcp }); // record-only for MCP: defer the heavy AIF graph sync

      console.log('[ca] Auto-created WHY move for AIF attack:', {
        attackId: created.id,
        attackType: d.legacyAttackType,
        targetType,
        targetId,
        cqId,
        cqText: cqText ? cqText.substring(0, 50) + '...' : 'none',
      });
    }
  } catch (err) {
    console.error('[ca] Failed to auto-create WHY move:', err);
    // Don't fail the whole request if WHY creation fails
  }
  
  // inside POST, after create ConflictApplication (in same transaction if you prefer)
const { schemeKey, cqKey, conflictedArgumentId } = d as any;
if (schemeKey && cqKey && conflictedArgumentId) {
  await prisma.cQStatus.updateMany({
    where: { targetType: 'argument' as TargetType, targetId: conflictedArgumentId, schemeKey, cqKey },
    data: { status: 'answered', satisfied: true }
  }).catch(() => {});
}

  // Optional AF materialization (only when attacking an Argument)
  if (d.legacyAttackType && d.conflictedArgumentId && d.conflictingArgumentId) {
  await prisma.argumentEdge.create({
    data: {
      deliberationId: d.deliberationId,
      createdById: String(userId),
      fromArgumentId: d.conflictingArgumentId,
      toArgumentId:   d.conflictedArgumentId,
      type: d.legacyAttackType === 'UNDERCUTS' ? 'undercut' : 'rebut',
      attackType: d.legacyAttackType,
      targetScope: d.legacyTargetScope ?? (d.legacyAttackType === 'UNDERCUTS' ? 'inference' : 'conclusion'),
      targetClaimId: null, targetPremiseId: null, cqKey: null,
    }
  }).catch(()=>{});
}

  // ✨ PHASE 1: Compile DialogueMoves → LudicActs → AifNodes
  // This ensures ATTACK and WHY moves created above appear in LudicsPanel.
  // The CA (+ its auto ATTACK/WHY moves) is already committed; the ludics
  // recompile is best-effort. On a large deliberation compileFromMoves can take
  // 60s+ and blow its transaction timeout, so for MCP callers run it in the
  // BACKGROUND rather than blocking the tool response. Web callers stay sync.
  const compileLudics = async (): Promise<void> => {
    try {
      console.log('[ca] Compiling DialogueMoves to Ludics acts for deliberation:', d.deliberationId);
      await compileFromMoves(d.deliberationId);
      await syncLudicsToAif(d.deliberationId);
      await invalidateInsightsCache(d.deliberationId);
      console.log('[ca] ✓ Ludics compilation and AIF sync complete');
    } catch (err) {
      console.error('[ca] Failed to compile/sync Ludics:', err);
      // Don't fail the whole request if Ludics sync fails
    }
  };
  // Record-only for MCP (see /api/dialogue/move): skip the ludics recompile
  // entirely to avoid the 60-120s cost and the DB-starvation that blows
  // concurrent foreground writes. The CA + its auto ATTACK/WHY moves are already
  // committed. Web callers still compile synchronously.
  if (!mcp) {
    await compileLudics();
  } else {
    // MCP: enqueue a debounced, coalesced background compile instead of doing
    // nothing (DEFERRED_LUDICS_COMPILE_ROADMAP §4.4). Fire-and-forget — the CA
    // + its auto ATTACK/WHY moves are already committed, so a Redis hiccup must
    // never fail the request; a missed enqueue just delays freshness.
    void enqueueLudicsCompile(d.deliberationId).catch((err) => {
      console.error('[ca] enqueueLudicsCompile failed (non-fatal):', err);
    });
    console.log('[ca] MCP record-only: enqueued deferred ludics compile for', d.deliberationId);
  }

  return NextResponse.json({
    ok: true,
    id: created.id,
    // Additive fields for the MCP `attack_argument` tool: the linked ATTACK
    // move id and the ratification status so the tool can honestly report
    // "filed, pending human sign-off" (PROPOSED) vs EFFECTIVE (Q8).
    conflictApplicationId: created.id,
    attackMoveId,
    ratificationStatus,
    // Present only when the objection Claim was minted from groundsText.
    ...(objectionClaimId ? { objectionClaimId } : {}),
  }, NO_STORE);
}

const ListCA = z.object({
  deliberationId: z.string().min(6).optional(),
  targetArgumentId: z.string().optional(),
  targetClaimId: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
});

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const p = ListCA.safeParse({
    deliberationId: u.searchParams.get('deliberationId') ?? undefined,
    targetArgumentId: u.searchParams.get('targetArgumentId') ?? undefined,
    targetClaimId: u.searchParams.get('targetClaimId') ?? undefined,
    limit: u.searchParams.get('limit') ?? undefined,
  });
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status:400, ...NO_STORE });

  const { deliberationId, targetArgumentId, targetClaimId, limit } = p.data;
  const where: any = {};
  if (deliberationId) where.deliberationId = deliberationId;
  if (targetArgumentId) where.OR = [{ conflictedArgumentId: targetArgumentId }, { conflictingArgumentId: targetArgumentId }];
  if (targetClaimId) where.OR = [{ conflictedClaimId: targetClaimId }, { conflictingClaimId: targetClaimId }];

  const items = await prisma.conflictApplication.findMany({
    where, take: limit, orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ ok:true, items }, NO_STORE);
}
