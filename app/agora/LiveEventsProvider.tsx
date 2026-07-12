// app/agora/LiveEventsProvider.tsx
'use client';
import * as React from 'react';
import { mutate as swrMutate } from 'swr';

type AnyEvent = { id?: string; ts?: number; type: string; [k: string]: any };

// ---- central topics (share with server) ----
export const TOPICS = [
  'dialogue:moves:refresh','dialogue:cs:refresh','claims:edges:changed','cqs:changed','cards:changed',
  'decision:changed','votes:changed','stacks:changed','deliberations:created','comments:changed',
  'xref:changed','citations:changed','dialogue:changed'
] as const;

// ---- map topic -> SWR keys (Phase B2) ----
const KEYMAP: Record<string,(ev:any)=>string[]> = {
  'dialogue:moves:refresh': (e) =>
    e?.deliberationId ? [`/api/dialogue/moves?deliberationId=${encodeURIComponent(e.deliberationId)}`] : [],
  'dialogue:changed': (e) =>
    e?.deliberationId ? [`/api/ludics/orthogonal?dialogueId=${encodeURIComponent(e.deliberationId)}`] : [],
  'citations:changed': (e) =>
    e?.targetId ? [`/api/claims/${encodeURIComponent(e.targetId)}/evidence`] : [],
  'decision:changed': () => ['/api/hub/deliberations', '/api/agora/events?since=bootstrap'],
  'comments:changed': (e) =>
    e?.discussionId ? [`/api/discussions/${encodeURIComponent(e.discussionId)}/forum`] : [],
  // TODO: 'xref:changed','stacks:changed',…
};

// ---- tiny coalescer (kept consistent with Agora UI) ----
const FEED_CAP = 300;
const BUNDLE_WINDOW_MS = 3 * 60 * 1000;
const CITATION_BUNDLE_WINDOW_MS = 2 * 60 * 1000;

function coalesce(prev: any[], ev: AnyEvent): any[] {
  const evTs = ev.ts ?? Date.now();
  if (ev.type === 'citations:changed') {
    const key = `${ev.targetType}:${ev.targetId}`;
    const i = prev.findIndex((e:any) =>
      e.type==='bundle' && e.subtype==='citations' && e.tgtKey===key && evTs - e.ts <= CITATION_BUNDLE_WINDOW_MS
    );
    if (i >= 0) {
      const b = prev[i]; const count = (b.count || 1) + 1;
      const upd = { ...b, ts: evTs, count, title: `${count} sources attached` };
      const out = [upd, ...prev.filter((_, idx) => idx !== i)];
      return out.slice(0, FEED_CAP);
    }
  }
  if (ev.type === 'dialogue:changed' && ev.deliberationId) {
    const room = ev.deliberationId;
    const i = prev.findIndex((e:any) =>
      e.type==='bundle' && e.deliberationId===room && evTs - e.ts <= BUNDLE_WINDOW_MS
    );
    if (i >= 0) {
      const b = prev[i];
      const kinds = { ...(b.kinds || {}) };
      const k = (ev.chips?.[0] || 'MOVE') as string;
      kinds[k] = (kinds[k] || 0) + 1;
      const upd = { ...b, ts: evTs, kinds, meta: Object.entries(kinds).map(([kk,v])=>`${v} ${kk}`).join(' · ') };
      const out = [upd, ...prev.filter((_, idx) => idx !== i)];
      return out.slice(0, FEED_CAP);
    }
  }
  return [ev, ...prev].slice(0, FEED_CAP);
}

// ---- periodic safety backfill (Phase C1) ----
function useSafetyBackfill(onEvent: (e: AnyEvent) => void) {
  const lastTsRef = React.useRef<number>(0);

  // Also backfill on tab become visible / network back online
  React.useEffect(() => {
    const kick = async () => {
      try {
        const url = lastTsRef.current
          ? `/api/agora/events?since=${lastTsRef.current}`
          : `/api/agora/events?limit=0`;
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const items: AnyEvent[] = Array.isArray(j?.items) ? j.items : [];
        for (const e of items) {
          onEvent(e);
          if (e.ts && e.ts > lastTsRef.current) lastTsRef.current = e.ts;
        }
      } catch {}
    };
    const onVis = () => { if (document.visibilityState === 'visible') kick(); };
    const onOnline = () => kick();

    const id = setInterval(kick, 60_000);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);

    // first tick is cheap (limit=0)
    kick();

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
    };
  }, [onEvent]);
}

export function LiveEventsProvider({ children }: { children: React.ReactNode }) {
  const bufRef = React.useRef<any[]>([]);
  const lastIdRef = React.useRef<string | null>(
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('agora:lastEventId') : null
  );

  const handle = React.useCallback((raw: any) => {
    let ev: AnyEvent | null = null;
    try { ev = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch {}
    if (!ev || !ev.type) return;

    // 1) coalesce recent feed (optional consumers)
    bufRef.current = coalesce(bufRef.current, ev);

    // 2) targeted SWR revalidate (dedupe)
    const keys = new Set(KEYMAP[ev.type]?.(ev) ?? []);
    if (keys.size) {
      // micro-batch mutate to avoid stampedes in bursts
      queueMicrotask(() => {
        for (const k of keys) swrMutate(k, undefined, { revalidate: true });
      });
    }

    // 3) legacy window CustomEvent bridge (until all consumers migrate)
    try { window.dispatchEvent(new CustomEvent(ev.type, { detail: ev })); } catch {}
  }, []);

  useSafetyBackfill(handle);

  React.useEffect(() => {
    const qs = lastIdRef.current ? `?lastEventId=${encodeURIComponent(lastIdRef.current)}` : '';
    const es = new EventSource(`/api/events${qs}`);

    const saveId = (id?: string | null) => {
      if (!id) return;
      lastIdRef.current = String(id);
      try { sessionStorage.setItem('agora:lastEventId', String(id)); } catch {}
    };

    // Default unlabeled events (server currently sends named + heartbeats)
    es.onmessage = (ev: MessageEvent) => {
      // Some user agents expose lastEventId here
      // @ts-ignore
      const id = (ev as any)?.lastEventId || (ev as any)?.id;
      if (id) saveId(id);
      handle(ev.data);
    };

    // Named topics
    for (const t of TOPICS) {
      es.addEventListener(t, (ev: MessageEvent) => {
        // @ts-ignore
        const id = (ev as any)?.lastEventId || (ev as any)?.id;
        if (id) saveId(id);
        try {
          const j = JSON.parse(ev.data as any);
          const flat = j?.payload && typeof j.payload === 'object'
            ? { type: t, ...j.payload }
            : { type: t, ...j };
          handle(flat);
        } catch {}
      });
    }

    // Gentle error handler: let browser reconnect, but trigger an immediate backfill on next open
    es.onerror = () => {/* auto-reconnect is built-in */};

    return () => es.close();
  }, [handle]);

  return <>{children}</>;
}
