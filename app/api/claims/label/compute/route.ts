export const dynamic = "force-dynamic";

// app/api/claims/label/compute/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { recomputeGroundedForDelib } from '@/lib/ceg/grounded';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deliberationId = searchParams.get('deliberationId');
  const res = await recomputeGroundedForDelib(deliberationId);
  return NextResponse.json({ ok: true, ...res });
}
