// app/api/rooms/[id]/decentralise/status/route.ts

import { NextRequest } from 'next/server';
import { decentraliseEvents } from '@/server/jobs/decentralise.worker';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (data: any) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      const onProg = (e: any) => send({ type: 'progress', ...e });
      const onComp = (e: any) => { send({ type: 'complete', ...e }); controller.close(); };
      const onFail = (e: any) => { send({ type: 'failed', ...e }); controller.close(); };
      decentraliseEvents.on('progress', onProg);
      decentraliseEvents.on('completed', onComp);
      decentraliseEvents.on('failed', onFail);
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
