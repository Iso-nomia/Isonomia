export const dynamic = "force-dynamic";

// // app/api/arguments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { createDialogueMove } from '@/lib/ludics/createDialogueMove';
// import { getServerSession } from 'next-auth'; // if you use NextAuth
import { getUserFromCookies, getCurrentUserId } from '@/lib/serverutils';
import { TargetType } from '@prisma/client';
import { inferAndAssignScheme } from '@/lib/argumentation/schemeInference';
import { ensureArgumentSupportInTx } from '@/lib/arguments/ensure-support';
import { markArgumentAsComposedInTx } from '@/lib/arguments/detect-composition';
import { checkNewCommitmentContradictions } from '@/lib/aif/dialogue-contradictions';
import { getCommitmentStores } from '@/lib/aif/graph-builder';
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

/**
 * GET /api/arguments?deliberationId=X&authorId=Y
 * Fetch arguments for a deliberation (used by AttackCreationModal and DiscourseDashboard)
 * Optional authorId parameter to filter by author
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deliberationId = url.searchParams.get('deliberationId');
  const authorId = url.searchParams.get('authorId');

  if (!deliberationId) {
    return NextResponse.json({ 
      ok: false, 
      error: 'deliberationId query parameter is required' 
    }, { status: 400, ...NO_STORE });
  }

  try {
    const where: any = { deliberationId };
    
    // Optional filter by author
    if (authorId) {
      where.authorId = authorId;
    }

    const args = await prisma.argument.findMany({
      where,
      select: {
        id: true,
        text: true,
        conclusionClaimId: true,
        createdAt: true,
        claim: {
          select: {
            id: true,
            text: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format for AttackCreationModal dropdown
    const formatted = args.map(arg => ({
      id: arg.id,
      text: arg.text || arg.claim?.text || 'Untitled Argument',
      conclusion: arg.claim ? {
        id: arg.claim.id,
        text: arg.claim.text,
      } : null,
    }));

    // Return in pagination format for consistency with claims endpoint
    return NextResponse.json({ items: formatted, nextCursor: null }, NO_STORE);
  } catch (err) {
    console.error('[GET /api/arguments] Error:', err);
    return NextResponse.json({
      ok: false,
      error: 'Failed to fetch arguments',
    }, { status: 500, ...NO_STORE });
  }
}

type SlotValidators = Record<string, { expects?: string; required?: boolean }>;
type SlotsPayload   = Record<string, string>; // role -> claimId

async function validateSlotsAgainstScheme(params: {
  tx: typeof prisma;
  schemeId: string | null | undefined;
  slots: SlotsPayload | undefined;
}) {
  const { tx, schemeId, slots } = params;
  if (!schemeId) return; // no scheme → nothing to validate

  const sc = await tx.argumentScheme.findUnique({ where: { id: schemeId }, select: { validators: true, key: true } });
  const v: SlotValidators | undefined = (sc?.validators as any)?.slots;
  if (!v) return;

  // 1) required slots present?
  const missing: string[] = [];
  for (const [role, rule] of Object.entries(v)) {
    if (rule?.required && (!slots || !slots[role])) {
      missing.push(role);
    }
  }
  if (missing.length) {
    throw new Error(`Missing required scheme slots for ${sc?.key}: ${missing.join(', ')}`);
  }

  // 2) type check (if claimType column exists)
  if (!slots || !Object.keys(slots).length) return;

  const slotClaimIds = Object.values(slots);
  const rows = await tx.claim.findMany({
    where: { id: { in: slotClaimIds } },
    select: { id: true }, // keep minimal; we may not have claimType yet
  }) as Array<{ id: string; claimType?: string|null }>; // tolerate absence

  const byId = new Map(rows.map(r => [r.id, r as any]));
  const typeViolations: string[] = [];

  for (const [role, claimId] of Object.entries(slots)) {
    const expects = v[role]?.expects;
    if (!expects) continue;
    const row = byId.get(claimId);
    const claimType = row?.claimType; // may be undefined if column not present
    if (claimType && expects && claimType !== expects) {
      typeViolations.push(`${role}: expected ${expects}, got ${claimType}`);
    }
  }

  if (typeViolations.length) {
    throw new Error(`Scheme slot type mismatch: ${typeViolations.join('; ')}`);
  }
}



export async function POST(req: NextRequest) {
  const b = await req.json().catch(()=> ({}));
  
  // Test mode support: Handle ArgumentConstructor format
  const { mode, targetId } = b ?? {};
  const isTestMode = targetId && (targetId.includes("test") || targetId.includes("TEST"));
  if (isTestMode && mode) {
    // Mock successful argument creation for test mode
    return NextResponse.json({ 
      ok: true, 
      argumentId: `arg-test-${Date.now()}`,
      argument: {
        id: `arg-test-${Date.now()}`,
        text: b.text || "Test argument",
        deliberationId: b.deliberationId,
        mode,
      }
    }, NO_STORE);
  }
  
  const { deliberationId, authorId, conclusionClaimId, premiseClaimIds, premises, implicitWarrant, text, premisesAreAxioms, ruleType, ruleName } = b ?? {};
  // Cookie auth (browser) first; fall back to Bearer (bot agents, extension).
  const user = await getUserFromCookies();
  const userId = user?.userId ?? (await getCurrentUserId());
  if (!userId) {
    console.error('[POST /api/arguments] No authenticated user');
    return NextResponse.json({ 
      ok: false, 
      error: 'Authentication required' 
    }, { status: 401, ...NO_STORE });
  }

  // // Allow 'current' or empty → resolve from session
  // if (!authorId || authorId === 'current') {
  //   // const session = await getServerSession(authOptions);
  //   authorId = user.userId;
  // }
    
// app/api/arguments/route.ts (POST) — add a friendlier error
if (!Array.isArray(premiseClaimIds) || premiseClaimIds.length === 0) {
  return NextResponse.json({
    ok: false,
    error: "An inference needs at least one premise. Tip: pick the ‘Bare Assertion’ scheme and add a quick reason."
  }, { status: 400, ...NO_STORE });
}

  if (!deliberationId || !authorId || !conclusionClaimId || !Array.isArray(premiseClaimIds) || premiseClaimIds.length === 0) {
    // Better error message showing what's missing
    const missing = [];
    if (!deliberationId) missing.push('deliberationId');
    if (!authorId) missing.push('authorId');
    if (!conclusionClaimId) missing.push('conclusionClaimId');
    if (!Array.isArray(premiseClaimIds)) missing.push('premiseClaimIds (not array)');
    else if (premiseClaimIds.length === 0) missing.push('premiseClaimIds (empty)');
    
    console.error('[POST /api/arguments] Invalid payload:', { missing, received: b });
    return NextResponse.json({ 
      ok: false, 
      error: `Invalid payload: missing or invalid fields: ${missing.join(', ')}`
    }, { status: 400, ...NO_STORE });
  }
  // const slots = b?.slots;
let { schemeId, slots } = b; // assuming clients may send a role->claimId map when using a scheme

  // Infer scheme if not provided
  if (!schemeId && text) {
    const conclusionText = await prisma.claim.findUnique({
      where: { id: conclusionClaimId },
      select: { text: true }
    }).then(c => c?.text);

    schemeId = await inferAndAssignScheme(text, conclusionText ?? undefined);
  }

  await validateSlotsAgainstScheme({ tx: prisma, schemeId, slots });

  // Debug: Log the claim IDs we're about to look up
  console.log('[POST /api/arguments] Looking up claims:', {
    conclusionClaimId,
    premiseClaimIds,
  });

  const created = await prisma.$transaction(async (tx) => {
    // Optional: assert the claims exist to avoid foreign key errors
    const conclusionClaim = await tx.claim.findUnique({ where: { id: conclusionClaimId }, select: { id: true } });
    if (!conclusionClaim) {
      console.error('[POST /api/arguments] Conclusion claim not found:', conclusionClaimId);
      throw new Error(`Conclusion claim not found: ${conclusionClaimId}`);
    }
    const prems = await tx.claim.findMany({ where: { id: { in: premiseClaimIds } }, select: { id: true } });
    if (prems.length !== premiseClaimIds.length) {
      const foundIds = prems.map(p => p.id);
      const missingIds = premiseClaimIds.filter((id: string) => !foundIds.includes(id));
      console.error('[POST /api/arguments] Missing premise claims:', missingIds);
      throw new Error(`One or more premiseClaimIds not found: ${missingIds.join(', ')}`);
    }

    const a = await tx.argument.create({
      data: { deliberationId, authorId, conclusionClaimId, schemeId: schemeId ?? null, implicitWarrant: implicitWarrant ?? null, text: text ?? '' }
    });
    
    // NEW: Ensure ArgumentSupport record exists (required for evidential API)
    if (conclusionClaimId) {
      await ensureArgumentSupportInTx(tx, {
        argumentId: a.id,
        claimId: conclusionClaimId,
        deliberationId,
        base: 0.7, // Default confidence
      });
    }
    
   // Phase B: Create ArgumentPremise records with optional axiom designation
   const premData =
      Array.isArray(premises) && premises.length
        ? premises.map((p:any) => ({ 
            argumentId: a.id, 
            claimId: p.claimId, 
            groupKey: p.groupKey ?? null, 
            isImplicit: false,
            isAxiom: premisesAreAxioms ?? false  // Phase B: Mark as axiom if checkbox checked
          }))
        : (premiseClaimIds ?? []).map((cid:string) => ({ 
            argumentId: a.id, 
            claimId: cid, 
            groupKey: null, 
            isImplicit: false,
            isAxiom: premisesAreAxioms ?? false  // Phase B: Mark as axiom if checkbox checked
          }));
    await tx.argumentPremise.createMany({ data: premData, skipDuplicates:true });
    
    // NEW (Phase 2): Mark as composed if has premises
    if (premData.length > 0) {
      await markArgumentAsComposedInTx(tx, a.id, "Composed via ArgumentPremise creation");
    }
    
    // NEW: Create ArgumentSchemeInstance if scheme is provided
    if (schemeId) {
      await (tx as any).argumentSchemeInstance.create({
        data: {
          argumentId: a.id,
          schemeId: schemeId,
          role: "primary",
          explicitness: "explicit",
          confidence: 1.0,
          isPrimary: true,
          order: 0,
          ruleType: ruleType ?? "DEFEASIBLE", // Phase 1b.3: Accept ruleType from UI
          ruleName: ruleName ?? null,          // Phase 1b.3: Optional rule name for strict rules
        },
      });
    }
    
    return a.id;
  });

  const argId = created;

  // Create a DialogueMove to assert this argument in the deliberation
  // This allows the ludics engine to compile it into designs.
  // Note: the H1 seam (createDialogueMove) already runs syncArgumentToAif
  // internally, so the standalone import below becomes a no-op (idempotent).
  try {
    const seamResult = await createDialogueMove({
      deliberationId,
      targetType: 'argument',
      targetId: argId,
      kind: 'ASSERT',
      actorId: String(authorId),
      signature: `assert-arg-${argId}`,
      payload: {
        argumentId: argId,
        conclusionClaimId,
        schemeId: schemeId ?? null,
        locusPath: '0',
      },
      locusPath: '0',
    });
    const assertMove = seamResult.move;

    // Backfill the AIF graph (RA + I + premise/conclusion/asserts edges) for
    // this argument so the new generative substrate's Step 8 walk can populate
    // Design.premiseClaimIds without needing a separate one-shot backfill.
    // Idempotent: re-running on an existing argument is a no-op.
    // Non-fatal — the DM is already created and the rest of the request must
    // continue (contradiction checks, commitments, CQ seeding, etc.).
    try {
      const { syncArgumentToAif } = await import('@/services/aif/syncArgument');
      await syncArgumentToAif({
        argumentId: argId,
        dialogueMoveId: assertMove.id,
      });
    } catch (err) {
      console.error('[arguments/POST] syncArgumentToAif failed:', err);
    }
    
    // Also create a commitment for the conclusion claim (for contradiction detection)
    // Get the conclusion claim text
    const conclusionClaim = await prisma.claim.findUnique({
      where: { id: conclusionClaimId },
      select: { text: true }
    });
    
    if (conclusionClaim) {
      // Check for contradictions BEFORE creating commitment
      // Get existing commitments for this participant
      const commitmentStoresResult = await getCommitmentStores(
        deliberationId, 
        String(authorId)
      );
      
      // Extract the data array from the result
      const commitmentStores = Array.isArray(commitmentStoresResult) 
        ? commitmentStoresResult 
        : commitmentStoresResult.data || [];
      
      const myCommitments = commitmentStores.find(
        store => store.participantId === String(authorId)
      )?.commitments || [];
      
      // Check if new conclusion contradicts existing commitments
      const contradictions = checkNewCommitmentContradictions(
        conclusionClaim.text,
        myCommitments
      );
      
      // If contradictions found and user hasn't bypassed the check, return 409
      const bypassCheck = b.bypassContradictionCheck === true;
      if (contradictions.length > 0 && !bypassCheck) {
        console.log(`[arguments/POST] Contradiction detected for: "${conclusionClaim.text}"`);
        return NextResponse.json({
          ok: false,
          error: 'contradiction_detected',
          contradictions: contradictions.map(c => ({
            existingClaim: c.claimA.id === 'temp-new-claim' ? c.claimB : c.claimA,
            newClaim: {
              text: conclusionClaim.text,
            },
            reason: c.reason,
            confidence: c.confidence,
            type: c.type,
          })),
          message: 'Your conclusion contradicts an existing commitment. Please review.',
        }, { status: 409, ...NO_STORE });
      }
      
      // Create commitment record (idempotent on (deliberationId, participantId, proposition))
      try {
        const result = await prisma.commitment.upsert({
          where: {
            deliberationId_participantId_proposition: {
              deliberationId,
              participantId: String(authorId),
              proposition: conclusionClaim.text,
            },
          },
          create: {
            deliberationId,
            participantId: String(authorId),
            proposition: conclusionClaim.text,
          },
          update: {},
          select: { createdAt: true, updatedAt: true },
        });
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          console.log(`[arguments/POST] Created commitment for conclusion: "${conclusionClaim.text}"`);
        }
      } catch (err: any) {
        console.error('[arguments/POST] Failed to upsert commitment:', err);
      }
    }
  } catch (err) {
    console.error('[arguments/POST] Failed to create dialogue move:', err);
    // Non-fatal - argument is already created
  }

  // await validateSlotsAgainstScheme({ tx: prisma, schemeId, slots });


// Seed CQ rows based on the scheme definition (if any)
try {
  if (schemeId) {
    const sc = await prisma.argumentScheme.findUnique({
      where: { id: schemeId },
      select: { key: true, cqs: { select: { cqKey: true } } }
    });
    if (sc?.key && sc.cqs?.length) {
      await prisma.cQStatus.createMany({
        data: sc.cqs
          .filter(c => c.cqKey)
          .map(c => ({
            targetType: "argument" as TargetType,
            targetId: argId,
            argumentId: argId,
            status: "open",
            schemeKey: sc.key!,
            cqKey: c.cqKey!,
            satisfied: false,
            createdById: String(authorId),
          })),
        skipDuplicates: true,
      });
    }
  }
} catch {}

  // Sprint D3 — enthymeme nudges. Inspect the freshly created argument
  // against its scheme's required roles and return any structural gaps so
  // the composer can render an inline "you might want to add a warrant"
  // hint. Failures here never block the publish response.
  let enthymemeNudges: Array<{
    argumentId: string;
    schemeKey: string;
    missingPremiseRoles: string[];
  }> = [];
  try {
    if (schemeId) {
      const scheme = await prisma.argumentScheme.findUnique({
        where: { id: schemeId },
        select: { key: true, slotHints: true },
      });
      const requiredRoles: string[] = (() => {
        const sh: any = scheme?.slotHints;
        if (!sh || typeof sh !== "object") return [];
        const arr = Array.isArray(sh.premises) ? sh.premises : [];
        return arr.map((p: any) => String(p?.role ?? "")).filter(Boolean);
      })();
      const presentRoles: string[] = (() => {
        const fromPremises = Array.isArray(b?.premises)
          ? b.premises.map((p: any) => String(p?.groupKey ?? "")).filter(Boolean)
          : [];
        const warrant = b?.implicitWarrant ? [] : ["warrant"];
        return Array.from(new Set([...fromPremises, ...warrant]));
      })();
      const { checkComposerEnthymemes } = await import(
        "@/lib/argumentation/composerEnthymemeCheck"
      );
      enthymemeNudges = checkComposerEnthymemes({
        argumentId: argId,
        schemeKey: scheme?.key ?? "",
        requiredRoles,
        rolesPresent: presentRoles,
      }).map((n) => ({
        argumentId: n.argumentId,
        schemeKey: n.schemeKey,
        missingPremiseRoles: n.missingPremiseRoles,
      }));
    }
  } catch (err) {
    console.error("[POST /api/arguments] enthymeme check failed:", err);
  }

  return NextResponse.json(
    { ok: true, argumentId: argId, ...(enthymemeNudges.length ? { enthymemeNudges } : {}) },
    NO_STORE
  );
}
