// lib/client/useBusEffect.ts
"use client";

import { useEffect, useRef } from "react";
import type { BusEvent } from "@/lib/events/topics";

 type BusEnvelope<T extends BusEvent = BusEvent> = {
  type: T;
  ts: number;
} & Record<string, any>;
type Topics<T extends BusEvent> = T[] | "all" | "*";

type Options = {
  url?: string;
  withCredentials?: boolean;
  retry?: boolean;
  maxRetryDelayMs?: number;
};

/** 🔧 enumerate all topics we care about (used when topics='*'/'all') */
const ALL_TOPICS: BusEvent[] = [
  "dialogue:moves:refresh",
  "dialogue:cs:refresh",
  "claims:edges:changed",
  "cqs:changed",
  "cards:changed",
  "decision:changed",
  "votes:changed",
  "stacks:changed",
  "deliberations:created",
  "comments:changed",
  "xref:changed",
  "citations:changed",
  "dialogue:changed",
];

/** Normalize server envelopes:
 *  - accept {type, ...} or {type, payload:{...}} (flatten payload)
 *  - when receiving a named SSE (no 'type' in data), use fallbackType
 */
function normalize<T extends BusEvent = BusEvent>(raw: any, fallbackType?: T): BusEnvelope<T> | null {
  if (!raw) return fallbackType ? ({ type: fallbackType, ts: Date.now() } as any) : null;

  // If server sent data already with a type at top-level
  if (raw.type) {
    if (raw.payload && typeof raw.payload === "object") {
      return { type: raw.type, ...raw.payload } as any;
    }
    return raw as BusEnvelope<T>;
  }

  // If server used named SSE event and data is just the payload
  if (fallbackType) {
    if (raw.payload && typeof raw.payload === "object") {
      return { type: fallbackType, ...raw.payload } as any;
    }
    return { type: fallbackType, ...raw } as any;
  }

  return null;
}

/**
 * Subscribe to server-sent bus events and invoke `handler` for matching topics.
 */
export function useBusEffect<T extends BusEvent = BusEvent>(
  topics: Topics<T>,
  handler: (e: BusEnvelope<T>) => void,
  opts: Options = {}
) {
  const { url = "/api/events", withCredentials = false, retry = true, maxRetryDelayMs = 30_000 } = opts;

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const topicsKey = Array.isArray(topics) ? topics.join(",") : topics;

  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;
    let retryDelay = 1000; // start at 1s

    const isAll = topics === "all" || topics === "*";
    const topicList: BusEvent[] = isAll ? ALL_TOPICS : (Array.isArray(topics) ? (topics as BusEvent[]) : []);

    const allow = (t: BusEvent | undefined): t is T =>
      !!t && (isAll || topicList.includes(t as BusEvent));

    const open = () => {
      if (closed) return;
      es = new EventSource(url, { withCredentials });

      // 1) Default 'message' channel (server might send unlabeled)
      es.onmessage = (ev) => {
        try {
          const raw = JSON.parse(ev.data);
          const msg = normalize<BusEvent>(raw);
          if (msg && allow(msg.type)) {
            handlerRef.current(msg as any);
          }
        } catch {
          /* ignore malformed payloads */
        }
      };

      // 2) Named SSE events (server uses: "event: <topic>")
      for (const name of topicList) {
        es!.addEventListener(name, (ev: MessageEvent) => {
          try {
            const raw = JSON.parse(ev.data);
            const msg = normalize<BusEvent>(raw, name);
            if (msg && allow(msg.type)) {
              handlerRef.current(msg as any);
            }
          } catch {
            /* ignore malformed payloads */
          }
        });
      }

      es.onerror = () => {
        if (!retry) return;
        try { es?.close(); } catch {}
        es = null;
        if (closed) return;
        setTimeout(open, retryDelay);
        retryDelay = Math.min(retryDelay * 2, maxRetryDelayMs);
      };
    };

    open();

    return () => {
      closed = true;
      try { es?.close(); } catch {}
      es = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsKey, url, withCredentials, retry, maxRetryDelayMs]);
}