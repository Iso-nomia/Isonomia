export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { runOnce } from '@/jobs/embed_retry_worker';

export async function GET() {
  if (process.env.ENABLE_EMBED_RETRY !== 'true') {
    return NextResponse.json({ skipped: true });
  }
  await runOnce();
  return NextResponse.json({ success: true });
}
