// app/api/bus/subscribe/route.ts
import { NextRequest } from 'next/server';
import bus, { onBus, offBus } from '@/lib/server/bus';
import { BUS_EVENTS, type BusEvent } from '@/lib/events/topics';

export const dynamic = 'force-dynamic';

type Envelope = { id: string; ts: number; type: BusEvent; [k: string]: any };

// Global, monotonic id for this process (dev hot-reload safe)
const SEQ = (globalThis as any).__busSeq__ ??= { v: 0 };
const nextId = () => String(++SEQ.v);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const topicsRaw = (url.searchParams.get('topics') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Validate + dedupe topics
  const allow = new Set(BUS_EVENTS);
  const wanted = topicsRaw.length
    ? Array.from(new Set(topicsRaw.filter((t) => allow.has(t as BusEvent)))) as BusEvent[]
    : (['dialogue:moves:refresh','dialogue:changed','citations:changed','comments:changed','deliberations:created','decision:changed','votes:changed','xref:changed','stacks:changed'] as BusEvent[]);
  const encoder = new TextEncoder();

  let closed = false;
  let cleanup: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (e: Envelope) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
        } catch {
          closed = true;
          try { cleanup(); } catch {}
        }
      };

      // Subscribe
      const unsubs: Array<() => void> = [];
      for (const t of wanted) {
        const h = (detail: any) => {
          const env: Envelope = { id: nextId(), ts: Date.now(), type: t, ...(detail || {}) };
          send(env);
        };
        onBus(t, h);
        unsubs.push(() => offBus(t, h));
      }

      // Backoff hint + heartbeat
      controller.enqueue(encoder.encode(`retry: 10000\n\n`));
      const ping = setInterval(() => {
        try { controller.enqueue(encoder.encode(`:hb ${Date.now()}\n\n`)); } catch {}
      }, 15_000);

      // Initial hello
      send({ id: nextId(), type: 'dialogue:changed', ts: Date.now(), hello: true, topics: wanted } as Envelope);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubs.forEach((fn) => { try { fn(); } catch {} });
        try { controller.close(); } catch {}
      };

      // Abort from client
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
