// app/api/bus/sse/route.ts
import { NextRequest } from 'next/server';
import bus, { onBus, offBus } from '@/lib/server/bus';
import { BUS_EVENTS, type BusEvent } from '@/lib/events/topics';

export const dynamic = 'force-dynamic';

type Envelope = { id: string; ts: number; type: BusEvent; [k: string]: any };
const SEQ = (globalThis as any).__busSeq__ ??= { v: 0 };
const nextId = () => String(++SEQ.v);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deliberationFilter = url.searchParams.get('deliberationId') || undefined;

  const encoder = new TextEncoder();
  let closed = false;
  let cleanup: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (e: Envelope) => {
        if (closed) return;
        if (deliberationFilter && e?.deliberationId && e.deliberationId !== deliberationFilter) return;
        try {
          controller.enqueue(encoder.encode(`id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
        } catch {
          closed = true;
          try { cleanup(); } catch {}
        }
      };

      const handlers = BUS_EVENTS.map((t) => {
        const h = (detail: any) => send({ id: nextId(), ts: Date.now(), type: t, ...(detail || {}) } as Envelope);
        onBus(t, h);
        return { t, h };
      });

      // Backoff hint + heartbeat
      controller.enqueue(encoder.encode(`retry: 10000\n\n`));
      const pingId = setInterval(() => {
        try { controller.enqueue(encoder.encode(`:hb ${Date.now()}\n\n`)); } catch {}
      }, 15_000);

      // hello
      send({ id: nextId(), type: 'dialogue:changed', ts: Date.now(), hello: true, deliberationId: deliberationFilter } as Envelope);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(pingId);
        handlers.forEach(({ t, h }) => offBus(t, h));
        try { controller.close(); } catch {}
      };

      try { req.signal.addEventListener('abort', cleanup); } catch {}
    },
    cancel() { try { cleanup(); } catch {} },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
