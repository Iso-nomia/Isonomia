"use client";

import * as React from "react";
import type { RawContrary } from "./useContraryCount";

export type ContraryPair = {
  id: string;
  claimId: string;
  contraryId: string;
  isSymmetric: boolean;
  status: string;
  reason?: string | null;
};

export type UseDeliberationContrariesResult = {
  /** All ACTIVE contrary relations in the deliberation. */
  pairs: ContraryPair[];
  /** Set of claim IDs that participate in at least one ACTIVE contrary. */
  claimIds: Set<string>;
  loading: boolean;
  refetch: () => void;
};

/**
 * Fetch all ACTIVE contraries for a deliberation. Used by graph viewers and
 * other surfaces that need a per-deliberation overlay rather than per-claim
 * lookups. Subscribes to `contraries:changed` and refetches on any event
 * matching this deliberation (or on events without detail).
 */
export function useDeliberationContraries(
  deliberationId?: string | null,
  enabled = true
): UseDeliberationContrariesResult {
  const [pairs, setPairs] = React.useState<ContraryPair[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!enabled || !deliberationId) {
      setPairs([]);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(
        `/api/contraries?deliberationId=${encodeURIComponent(deliberationId)}`,
        { cache: "no-store" }
      );
      if (r.ok) {
        const j = await r.json();
        const rows = (j.contraries ?? []) as RawContrary[];
        setPairs(
          rows
            .filter((row) => row.status === "ACTIVE")
            .map((row) => ({
              id: row.id,
              claimId: row.claimId,
              contraryId: row.contraryId,
              isSymmetric: row.isSymmetric,
              status: row.status,
              reason: row.reason ?? null,
            }))
        );
      }
    } catch (err) {
      console.error("[useDeliberationContraries] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [deliberationId, enabled]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    function onChanged(e: Event) {
      const detail = (e as CustomEvent).detail as
        | { deliberationId?: string }
        | undefined;
      if (!detail || !detail.deliberationId || detail.deliberationId === deliberationId) {
        load();
      }
    }
    window.addEventListener("contraries:changed", onChanged as EventListener);
    return () =>
      window.removeEventListener(
        "contraries:changed",
        onChanged as EventListener
      );
  }, [deliberationId, load]);

  const claimIds = React.useMemo(() => {
    const s = new Set<string>();
    for (const p of pairs) {
      s.add(p.claimId);
      s.add(p.contraryId);
    }
    return s;
  }, [pairs]);

  return { pairs, claimIds, loading, refetch: load };
}
