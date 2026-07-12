export const dynamic = "force-dynamic";

// app/api/dev/verify/route.ts
//
// ⚠️  DEV-ONLY — blocked in production.
//
import { NextRequest, NextResponse } from 'next/server';
import nacl from 'tweetnacl';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { payload, signature } = await req.json();
  const pub = Buffer.from(process.env.MESH_EXPORT_PUBLIC_KEY!, 'base64');
  const ok = nacl.sign.detached.verify(Buffer.from(JSON.stringify(payload)), Buffer.from(signature, 'base64'), pub);
  return NextResponse.json({ valid: ok });
}
