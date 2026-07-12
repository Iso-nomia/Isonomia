"use client";

import * as React from "react";

/**
 * Shape of a row returned by GET /api/contraries (subset we care about).
 */
export type RawContrary = {
  id: string;
  claimId: string;
  contraryId: string;
  isSymmetric: boolean;
  status: string;
  reason?: string | null;
  createdAt: string;
  claim: { id: string; text: string };
  contrary: { id: string; text: string };
  createdBy?: {
    id: string | number;
    username: string;
    name?: string | null;
    image?: string | null;
  };
};

/**
 * Direction of a contrary relation relative to a focal claim:
 *   - "outgoing": this claim asserts another is contrary (claimId === focal)
 *   - "incoming": some other claim asserts this one is contrary (contraryId === focal)
 */
export type ContraryDirection = "outgoing" | "incoming";

/**
 * Same as RawContrary, plus fields normalized to the focal claim:
 *   - direction: outgoing vs incoming
 *   - otherId/otherText: the other endpoint of the relation
 */
export type ContraryItem = RawContrary & {
  direction: ContraryDirection;
  otherId: string;
  otherText: string;
};

export type UseContraryCountArgs = {
  deliberationId?: string | null;
  claimId?: string | null;
  /** Default true. Set false to skip fetching (e.g., until parent data loads). */
  enabled?: boolean;
};

export type UseContraryCountResult = {
  count: number;
  items: ContraryItem[];
  outgoing: ContraryItem[];
  incoming: ContraryItem[];
  loading: boolean;
  refetch: () => void;
};

/**
 * Pure-logic helper exported for unit testing. Filters out non-ACTIVE rows
 * and tags each row with the focal-claim-relative direction + the "other"
 * endpoint's id/text.
 */
export function normalizeContraries(
  focalClaimId: string,
  raw: RawContrary[]
): ContraryItem[] {
  return raw
    .filter((r) => r.status === "ACTIVE")
    .map<ContraryItem>((r) => {
      const direction: ContraryDirection =
        r.claimId === focalClaimId ? "outgoing" : "incoming";
      const otherId =
        direction === "outgoing" ? r.contraryId : r.claimId;
      const otherText =
        direction === "outgoing" ? r.contrary?.text : r.claim?.text;
      return {
        ...r,
        direction,
        otherId,
        otherText: otherText ?? "Unknown claim",
      };
    });
}

function normalize(focalClaimId: string, raw: RawContrary[]): ContraryItem[] {
  return normalizeContraries(focalClaimId, raw);
}

/**
 * Fetch and live-track ACTIVE contrary relations for a single claim.
 * Listens for `window` "contraries:changed" events and refetches when
 * relevant (or always, when the event has no detail).
 *
 * Each returned item carries `direction` ("outgoing" | "incoming") and
 * `otherText` so callers can render direction-aware UI without re-deriving.
 */
export function useContraryCount(
  args: UseContraryCountArgs
): UseContraryCountResult {
  const { deliberationId, claimId, enabled = true } = args;
  const [items, setItems] = React.useState<ContraryItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!enabled || !deliberationId || !claimId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(
        `/api/contraries?deliberationId=${encodeURIComponent(
          deliberationId
        )}&claimId=${encodeURIComponent(claimId)}`,
        { cache: "no-store" }
      );
      if (r.ok) {
        const j = await r.json();
        setItems(normalize(claimId, (j.contraries ?? []) as RawContrary[]));
      }
    } catch (err) {
      // Silent — badge is best-effort. Keep prior items on failure.
      console.error("[useContraryCount] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [deliberationId, claimId, enabled]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as
        | { deliberationId?: string; claimId?: string }
        | undefined;
      // No detail → broad invalidation; refetch.
      if (!detail) return void load();
      // Detail present → only refetch if the event references this claim
      // (either side of the relation is enough).
      if (detail.deliberationId && detail.deliberationId !== deliberationId) return;
      if (!detail.claimId) return void load();
      if (detail.claimId === claimId) return void load();
      // Otherwise the event was about a different claim; ignore.
    }
    window.addEventListener("contraries:changed", handler);
    return () => window.removeEventListener("contraries:changed", handler);
  }, [load, deliberationId, claimId]);

  const outgoing = React.useMemo(
    () => items.filter((i) => i.direction === "outgoing"),
    [items]
  );
  const incoming = React.useMemo(
    () => items.filter((i) => i.direction === "incoming"),
    [items]
  );

  return {
    count: items.length,
    items,
    outgoing,
    incoming,
    loading,
    refetch: load,
  };
}
