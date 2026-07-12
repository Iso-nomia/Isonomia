export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { mintUrn } from '@/lib/ids/urn';

export async function POST(req: NextRequest) {
  const { entityType, entityId, moidHex } = await req.json();
  if (!entityType || !entityId || !moidHex) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const entityCode = entityType === 'claim' ? 'clm' : entityType === 'card' ? 'crd' : 'brf';
  const urn = mintUrn(entityCode as any, moidHex);
  const created = await prisma.urn.create({ data: { entityType, entityId, urn } });
  return NextResponse.json({ urn: created.urn });
}
