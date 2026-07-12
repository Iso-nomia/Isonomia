export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sha256Hex = (s:string)=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const normalize = (s:string)=>s.normalize('NFC').replace(/\s+/g,' ').trim();

const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const url = body.url ?? body.uri;
  const excerptText = body.excerptText ?? body.excerpt;
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  const excerptHash = excerptText ? sha256Hex(normalize(excerptText)) : null;

  if (!hasSupabase) {
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const snapshotKey = `${url}#${ts}`; // stub
    return NextResponse.json({ snapshotKey, excerptHash });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const res = await fetch(url, { redirect: 'follow' });
  const buf = Buffer.from(await res.arrayBuffer());
  const now = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `snapshots/${now}-${sha256Hex(url).slice(0,8)}.http`;

  const { error } = await supabase
    .storage
    .from(process.env.SNAPSHOTS_BUCKET || 'snapshots')
    .upload(key, buf, {
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
      upsert: false,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshotKey: key, excerptHash });
}
