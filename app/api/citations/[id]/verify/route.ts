export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { createClient } from '@supabase/supabase-js';
import { sha256Hex } from '@/lib/ids/canonicalize';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const cit = await prisma.claimCitation.findUnique({ where: { id: params.id } });
  if (!cit) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!cit.snapshotKey || !cit.excerptHash) {
    return NextResponse.json({ verified: false, reason: 'missing snapshot or excerpt' });
  }
  const { data, error } = await supabase.storage.from('snapshots').download(cit.snapshotKey);
  if (error || !data) return NextResponse.json({ verified: false, reason: 'snapshot download failed' });

  // Best-effort verify: re-hash the excerpt at the stored locator range and
  // compare against the recorded excerptHash.
  const body = await data.text();
  let verified = false;
  if (cit.locatorStart != null && cit.locatorEnd != null) {
    const excerpt = body.slice(cit.locatorStart, cit.locatorEnd);
    verified = excerpt.length > 0 && sha256Hex(excerpt) === cit.excerptHash;
  }

  return NextResponse.json({ verified });
}
