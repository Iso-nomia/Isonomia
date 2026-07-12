export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Ledger endpoint ready' });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  // TODO: persist to your DB. For now, echo.
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString(), body });
}
