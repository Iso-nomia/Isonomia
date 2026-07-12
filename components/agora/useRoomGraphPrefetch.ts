// components/agora/useRoomGraphPrefetch.ts
"use client";
import * as React from "react";
import { useConfidence } from "@/components/agora/useConfidence";

const cache = new Set<string>();

export function useRoomGraphPrefetch() {
  const { mode, tau } = useConfidence();

  return React.useCallback((roomId: string) => {
    const m = mode === "logodds" ? "product" : mode; // graph API accepts 'min'|'product'
    const qs = new URLSearchParams({ semantics: "preferred", mode: m, ...(tau!=null ? { confidence:String(tau) } : {}) });
    const url = `/api/deliberations/${roomId}/graph?` + qs.toString();
    if (cache.has(url)) return;
    cache.add(url);
    fetch(url, { cache: "no-store" }).catch(()=>{});
  }, [mode, tau]);
}
