// app/api/sheets/[id]/ruleset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Body = z.object({
  confidence: z.object({
    // Phase 5a (2026-06-03): "ds" retired from the confidence algebra. New
    // rulesets persist min/product/logodds only; any legacy persisted "ds" is
    // coerced to "product" at read time in app/api/evidential/score/route.ts.
    mode: z.enum(['min','product','logodds'])
  })
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sheetId = decodeURIComponent(params.id || '');
  if (!sheetId || sheetId.startsWith('delib:')) {
    return NextResponse.json({ ok:false, error: 'Cannot persist ruleset for synthetic delib:<id> views.' }, { status: 400 });
  }
  const body = Body.parse(await req.json());

  // merge with existing rulesetJson
  const sheet = await prisma.debateSheet.findUnique({
    where: { id: sheetId }, select: { id:true, rulesetJson:true }
  });
  if (!sheet) return NextResponse.json({ ok:false, error:'Not found' }, { status:404 });

  const rulesetJson = typeof sheet.rulesetJson === "object" && sheet.rulesetJson !== null && !Array.isArray(sheet.rulesetJson) ? sheet.rulesetJson as Record<string, any> : {};
  const confidenceJson = typeof rulesetJson.confidence === "object" && rulesetJson.confidence !== null && !Array.isArray(rulesetJson.confidence) ? rulesetJson.confidence : {};
  const ruleset = { ...rulesetJson, confidence: { ...confidenceJson, mode: body.confidence.mode } };
  await prisma.debateSheet.update({ where: { id: sheetId }, data: { rulesetJson: ruleset } });

  return NextResponse.json({ ok:true, sheetId, ruleset }, { headers: { 'Cache-Control':'no-store' } });
}
