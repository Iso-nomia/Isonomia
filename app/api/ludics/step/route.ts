export const dynamic = "force-dynamic";

// app/api/ludics/step/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stepInteraction } from 'packages/ludics-engine/stepper';
import { LudicError } from 'packages/ludics-core/errors';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';

const Body = z.object({
  dialogueId: z.string().min(10),
  posDesignId: z.string().min(10),
  negDesignId: z.string().min(10),
  startPosActId: z.string().optional(),
  phase: z.enum(['focus-P','focus-O','neutral']).optional(),
  fuel: z.number().int().min(1).max(10000).optional().default(2048),
  compositionMode: z.enum(['assoc','partial','spiritual']).optional().default('assoc'),
  testers: z.array(
    z.union([
      z.object({ kind: z.literal('herd-to'), parentPath: z.string(), child: z.string() }),
      z.object({ kind: z.literal('timeout-draw'), atPath: z.string() }),
    ])
  ).optional(),
  focusAt: z.string().optional(), // optional pin

});

/**
 * GET handler for computing interaction trace
 * Query params: deliberationId, phase?, maxPairs?, scope?, scopeType?
 * Automatically finds P/O designs for the deliberation
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deliberationId = searchParams.get('deliberationId');
    
    if (!deliberationId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing deliberationId query parameter' 
      }, { status: 400 });
    }
    
    const phase = searchParams.get('phase') as 'focus-P' | 'focus-O' | 'neutral' || 'neutral';
    const maxPairs = parseInt(searchParams.get('maxPairs') || '1024', 10);
    const scope = searchParams.get('scope'); // Optional: filter by specific scope
    const scopeType = searchParams.get('scopeType'); // Optional: filter by scope type
    
    // Find designs for this deliberation
    const where: any = { deliberationId };
    
    if (scope !== null && scope !== undefined) {
      where.scope = scope === 'null' ? null : scope;
    }
    
    if (scopeType) {
      where.scopeType = scopeType;
    }
    
    // Get all designs and group by scope to find P/O pairs
    const allDesigns = await prisma.ludicDesign.findMany({
      where,
      select: {
        id: true,
        deliberationId: true,
        participantId: true,
        scope: true,
        scopeType: true,
      },
      orderBy: [{ participantId: 'asc' }],
    });
    
    if (allDesigns.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: `No designs found for deliberation ${deliberationId}` 
      }, { status: 404 });
    }
    
    // Group by scope and find first scope with both P and O
    const byScope = new Map<string | null, typeof allDesigns>();
    for (const design of allDesigns) {
      const key = design.scope;
      if (!byScope.has(key)) byScope.set(key, []);
      byScope.get(key)!.push(design);
    }
    
    let posDesign: typeof allDesigns[0] | undefined;
    let negDesign: typeof allDesigns[0] | undefined;
    
    // Find first scope with both P and O
    for (const [scopeKey, scopeDesigns] of byScope.entries()) {
      const p = scopeDesigns.find(d => d.participantId === 'Proponent');
      const o = scopeDesigns.find(d => d.participantId === 'Opponent');
      if (p && o) {
        posDesign = p;
        negDesign = o;
        break;
      }
    }
    
    if (!posDesign || !negDesign) {
      return NextResponse.json({ 
        ok: false, 
        error: `Could not find P/O pair. Found ${allDesigns.length} designs across ${byScope.size} scopes` 
      }, { status: 404 });
    }
    
    // Run stepper
    const trace = await stepInteraction({
      dialogueId: deliberationId,
      posDesignId: posDesign.id,
      negDesignId: negDesign.id,
      phase,
      maxPairs,
      compositionMode: 'assoc',
      virtualNegPaths: [],
      drawAtPaths: [],
    });
    
    return NextResponse.json({ 
      ok: true, 
      trace,
      posDesignId: posDesign.id,
      negDesignId: negDesign.id,
    }, { 
      headers: { 'Cache-Control': 'no-store' } 
    });
    
  } catch (err: any) {
    console.error('[ludics/step GET] Error:', err);
    
    if (err instanceof LudicError) {
      return NextResponse.json({ 
        ok: false, 
        error: { code: err.code, message: err.message, info: err.info ?? null }
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      ok: false, 
      error: { code: 'INTERNAL', message: err?.message ?? 'Unknown error' }
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
    }
    
    const { dialogueId, posDesignId, negDesignId, startPosActId, phase, fuel, compositionMode, testers = [] } = parsed.data;

    // Map testers → stepper virtuals
    // const testers = parsed.data.testers ?? [];
const virtuals = testers.length ? (await import('@/packages/ludics-engine/testers')).buildVirtuals(testers) : { virtualNegPaths: [], drawAtPaths: [] };


    const res = await stepInteraction({
      dialogueId, posDesignId, negDesignId,
      startPosActId,
      phase: phase ?? 'neutral',
      maxPairs: fuel,
      compositionMode,
      virtualNegPaths: virtuals.virtualNegPaths,
      drawAtPaths: virtuals.drawAtPaths,
    });


    // const virtualNegPaths: string[] = [];
    // const drawAtPaths: string[] = [];
    // // for (const t of testers) {
    // //   if (t.kind === 'herd-to') virtualNegPaths.push(`${t.parentPath}.${t.child}`);
    // //   if (t.kind === 'timeout-draw') drawAtPaths.push(t.atPath);
    // // }

    // const res = await stepInteraction({
    //   dialogueId, posDesignId, negDesignId,
    //   startPosActId,
    //   phase: phase ?? 'neutral',
    //   maxPairs: fuel,
    //   compositionMode,
    //   virtualNegPaths: virtuals.virtualNegPaths,
    //   drawAtPaths: virtuals.drawAtPaths,
    // });

    return NextResponse.json({ ok:true, ...res }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    if (err instanceof LudicError) {
      return NextResponse.json({ ok:false, error:{ code: err.code, message: err.message, info: err.info ?? null }}, { status: 400 });
    }
    return NextResponse.json({ ok:false, error:{ code:'INTERNAL', message: err?.message ?? 'Unknown error' }}, { status: 500 });
  }
}
