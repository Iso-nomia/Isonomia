// app/api/events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bus, { onBus, offBus } from '@/lib/server/bus';
import { BUS_EVENTS } from '@/lib/events/topics';
import { EventEmitter } from 'node:events';

export const dynamic = 'force-dynamic';

// TEMP during refactor
EventEmitter.defaultMaxListeners = Math.max(EventEmitter.defaultMaxListeners, 50);

type FeedEvent = { id: string; ts: number; type: string; [k: string]: any };
const RING: { buf: FeedEvent[]; cap: number } = (globalThis as any).__agoraRing__ ??= { buf: [] as FeedEvent[], cap: 2048 };
let seq = (globalThis as any).__agoraSeq__ ??= 0;

function pushRing(e: Omit<FeedEvent,'id'>): FeedEvent {
  const full: FeedEvent = { ...e, ts: e.ts, type: e.type, id: String(++seq) };
  RING.buf.push(full);
  if (RING.buf.length > RING.cap) RING.buf.shift();
  return full;
}

export async function GET(req: NextRequest) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = (s: string) => writer.write(new TextEncoder().encode(s));

  const headers = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  } as const;

  const url = new URL(req.url);
  const lastQ = url.searchParams.get('lastEventId');
  const lastH = req.headers.get('last-event-id');
  const last  = lastQ ?? lastH ?? undefined;

  if (last) {
    const sinceId = Number(last);
    const backlog = RING.buf.filter((e) => Number(e.id) > sinceId);
    for (const e of backlog) {
      try {
        await enc(`id: ${e.id}\n`);
        await enc(`event: ${e.type}\n`);
        await enc(`data: ${JSON.stringify(e)}\n\n`);
      } catch { /* client gone; close below */ }
    }
  }

  await enc(`retry: 10000\n\n`); // backoff hint
  const beat = setInterval(() => enc(`:hb ${Date.now()}\n\n`).catch(()=>{}), 20_000);

  const handler = async (msg: any) => {
    try {
      const payload = msg && typeof msg === 'object' ? { ...msg } : {};
      // normalize to { type, ts, ...payload } if coming from legacy emitters
      const type = payload.type || 'message';
      const ts   = Number.isFinite(payload.ts) ? payload.ts : Date.now();
      const full = pushRing({ ts, type, ...payload });
      await enc(`id: ${full.id}\n`);
      await enc(`event: ${full.type}\n`);
      await enc(`data: ${JSON.stringify(full)}\n\n`);
    } catch {
      close();
    }
  };

  BUS_EVENTS.forEach((t) => onBus(t, handler));

  const close = () => {
    clearInterval(beat);
    try { BUS_EVENTS.forEach((t) => offBus(t, handler)); } catch {}
    try { writer.close(); } catch {}
  };

  req.signal.addEventListener('abort', close);
  return new NextResponse(readable as any, { headers });
}
