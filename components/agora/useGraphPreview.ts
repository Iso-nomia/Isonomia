// components/agora/useGraphPreview.ts
"use client";
import useSWRImmutable from "swr/immutable";
import { useConfidence } from "./useConfidence";

type Preview = { acceptedShare: number, counted: number };

function key(roomId: string, mode: string, tau: number|null) {
  const m = mode === "logodds" ? "product" : mode;
  const t = tau == null ? "na" : String(tau);
  return `/api/deliberations/${roomId}/graph?semantics=preferred&mode=${m}` + (tau==null ? "" : `&confidence=${t}`);
}
export function useGraphPreview(roomId?: string|null): { data?: Preview } {
  const { mode, tau } = useConfidence();
  const { data } = useSWRImmutable(roomId ? key(roomId, mode, tau) : null, async (u) => {
    const g = await fetch(u, { cache: "no-store" }).then(r=>r.json());
    const nodes = Array.isArray(g?.nodes) ? g.nodes : [];
    const total = nodes.length || 1;
    const accepted = nodes.filter((n:any)=> n.label === "IN").length;
    return { acceptedShare: accepted / total, counted: total } as Preview;
  });
  return { data };
}
