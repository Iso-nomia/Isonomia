import { NextRequest, NextResponse } from 'next/server';
import { buildAifGraphJSONLD } from '@/lib/aif/jsonld';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const deliberationId = u.searchParams.get('deliberationId') ?? undefined;
  const includeLocutions = u.searchParams.get('loc') === '1';
  const includeCQs = u.searchParams.get('cqs') === '1';

  if (!deliberationId) {
    return NextResponse.json({ ok:false, error: 'missing deliberationId' }, { status: 400 });
  }

  const doc = await buildAifGraphJSONLD({ deliberationId, includeLocutions, includeCQs });
  return NextResponse.json({ ok:true, ...doc }, { headers: { 'Cache-Control': 'no-store' } });
}
