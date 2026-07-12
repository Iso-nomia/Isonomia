export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const enabled = process.env.ENABLE_SEMANTICS_LF === '1';
  const { text } = await req.json().catch(() => ({ text: '' }));
  if (!enabled) return NextResponse.json({ ok: false, lf: null, note: 'LF disabled' });
  // TODO: plug your parser here; return a DRS/CCG/AMR-like LF
  return NextResponse.json({ ok: true, lf: null, note: 'Parser not wired yet' });
}
