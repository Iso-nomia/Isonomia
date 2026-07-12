import { NextRequest, NextResponse } from 'next/server';
import { buildAifGraphJSONLD } from '@/lib/aif/jsonld';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const deliberationId = u.searchParams.get('deliberationId') ?? undefined;
  const argumentId = u.searchParams.get('argumentId') ?? undefined;
  const includeLocutions = (u.searchParams.get('locutions') === '1');

  if (!deliberationId && !argumentId) {
    return NextResponse.json({ ok:false, error:'Provide deliberationId or argumentId' }, { status:400 });
  }

  const jsonld = await buildAifGraphJSONLD({
    deliberationId: deliberationId ?? undefined,
    argumentIds: argumentId ? [argumentId] : [],
    includeLocutions
  });
  return NextResponse.json(jsonld, { headers: { 'Cache-Control':'no-store' } });
}
