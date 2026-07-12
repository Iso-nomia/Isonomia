export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function sha256(s: string) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
function normalizeExcerpt(s: string) {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export async function POST(req: NextRequest) {
  try {
    const { excerptText, excerptHash } = await req.json();
    if (!excerptText || !excerptHash) return NextResponse.json({ ok: false, error: 'excerptText and excerptHash required' }, { status: 400 });
    const computed = sha256(normalizeExcerpt(excerptText));
    return NextResponse.json({ ok: computed === excerptHash });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}
