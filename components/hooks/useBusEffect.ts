"use client";

import * as React from "react";

type BusDetail = any;

/**
 * Subscribe to a list of window CustomEvent topics and call `fn(detail, type)`.
 * Cleans up on unmount. Optionally throttle calls via `waitMs`.
 */
export function useBusEffect(
  topics: string[] | readonly string[],
  fn: (detail: BusDetail, type: string) => void,
  waitMs = 0
) {
  React.useEffect(() => {
    if (!topics?.length) return;

    let last = 0;
    const handler = (type: string) => (ev: Event) => {
      const now = Date.now();
      if (waitMs > 0 && now - last < waitMs) return;
      last = now;
      const detail = (ev as CustomEvent).detail;
      try { fn(detail, type); } catch {}
    };

    const entries = topics.map((t) => {
      const h = handler(t);
      window.addEventListener(t, h as any);
      return { t, h };
    });

    return () => entries.forEach(({ t, h }) => window.removeEventListener(t, h as any));
  }, [Array.isArray(topics) ? topics.join("|") : "", waitMs, fn]);
}
