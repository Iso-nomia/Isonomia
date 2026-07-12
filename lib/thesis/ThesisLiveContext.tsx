// lib/thesis/ThesisLiveContext.tsx
//
// Living Thesis — Phase 1.2: client-side live data layer.
//
// Single SWR subscription per thesis page hits `/api/thesis/[id]/live`,
// then per-object lookups read from React context. Polling cadence backs
// off when the tab is hidden. The transport (SWR polling) is intentionally
// hidden behind this hook so a future SSE/WebSocket upgrade (deferred —
// see docs/LIVING_THESIS_DEFERRED.md D3) only touches this file.
//
// Consumed by:
//   - Live TipTap node views (Phase 1.3)
//   - Inspection drawer (Phase 2)
//   - Attack register (Phase 3)
//   - Confidence audit (Phase 4)

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR from "swr";

export type LiveKind = "claim" | "argument" | "proposition" | "chain";
export type LiveLabel = "IN" | "OUT" | "UNDEC";

export interface LiveObjectStats {
  kind: LiveKind;
  label?: LiveLabel;
  attackCount: number;
  undefendedAttackCount: number;
  defendedAttackCount: number;
  concededAttackCount: number;
  supportCount: number;
  evidenceCount: number;
  cqSatisfied?: number;
  cqTotal?: number;
  lastChangedAt: string;
  status?: string;
}

export interface LivePayload {
  cursor: string;
  computedAt: string;
  objects: Record<string, LiveObjectStats>;
}

/**
 * Inspector request shape. The drawer itself ships in Phase 2; this hook
 * already exposes the request channel so the live nodes (Phase 1.3) can be
 * wired with their click handlers without a follow-up refactor.
 */
export interface InspectorRequest {
  kind: LiveKind | "citation";
  id: string;
  /** Optional initial drawer tab. */
  tab?: "overview" | "attacks" | "provenance" | "evidence" | "cqs" | "history" | "nodes";
}

interface ThesisLiveContextValue {
  thesisId: string;
  payload: LivePayload | undefined;
  isLoading: boolean;
  error: unknown;
  /** Force an immediate refetch of the batched live payload. */
  refresh: () => Promise<void>;
  /** Look up live stats for one embedded object id. */
  getObject: (id: string) => LiveObjectStats | undefined;
  /** Open the inspector drawer for a given object (no-op until Phase 2). */
  openInspector: (req: InspectorRequest) => void;
  /** Subscribe to inspector-open requests (used by the drawer). */
  subscribeInspector: (handler: (req: InspectorRequest) => void) => () => void;
}

const ThesisLiveContext = createContext<ThesisLiveContextValue | null>(null);

const ACTIVE_INTERVAL_MS = 30_000;
const HIDDEN_INTERVAL_MS = 120_000;

const fetcher = async (url: string): Promise<LivePayload> => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Live stats fetch failed (${res.status}): ${body}`);
  }
  return (await res.json()) as LivePayload;
};

interface ProviderProps {
  thesisId: string;
  children: React.ReactNode;
  /** Override active poll interval; mostly for tests. */
  activeIntervalMs?: number;
  /** Override hidden-tab poll interval; mostly for tests. */
  hiddenIntervalMs?: number;
}

export function ThesisLiveProvider({
  thesisId,
  children,
  activeIntervalMs = ACTIVE_INTERVAL_MS,
  hiddenIntervalMs = HIDDEN_INTERVAL_MS,
}: ProviderProps) {
  const [hidden, setHidden] = useState<boolean>(
    typeof document === "undefined" ? false : document.hidden,
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const refreshInterval = hidden ? hiddenIntervalMs : activeIntervalMs;

  const { data, error, isLoading, mutate } = useSWR<LivePayload>(
    thesisId ? `/api/thesis/${thesisId}/live` : null,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5_000,
      keepPreviousData: true,
    },
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const getObject = useCallback(
    (id: string) => data?.objects?.[id],
    [data],
  );

  // Inspector pub/sub. The drawer (Phase 2) subscribes; for now openInspector
  // simply notifies any subscribers and falls back to a console hint when none
  // are mounted, so calls from Phase 1.3 nodes are observable but harmless.
  const subscribersRef = useRef<Set<(req: InspectorRequest) => void>>(new Set());

  const openInspector = useCallback((req: InspectorRequest) => {
    if (subscribersRef.current.size === 0) {
      // eslint-disable-next-line no-console
      console.debug("[thesis-live] openInspector called with no subscriber:", req);
      return;
    }
    for (const handler of subscribersRef.current) {
      try {
        handler(req);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[thesis-live] inspector subscriber threw", err);
      }
    }
  }, []);

  const subscribeInspector = useCallback(
    (handler: (req: InspectorRequest) => void) => {
      subscribersRef.current.add(handler);
      return () => {
        subscribersRef.current.delete(handler);
      };
    },
    [],
  );

  const value = useMemo<ThesisLiveContextValue>(
    () => ({
      thesisId,
      payload: data,
      isLoading,
      error,
      refresh,
      getObject,
      openInspector,
      subscribeInspector,
    }),
    [
      thesisId,
      data,
      isLoading,
      error,
      refresh,
      getObject,
      openInspector,
      subscribeInspector,
    ],
  );

  return (
    <ThesisLiveContext.Provider value={value}>
      {children}
    </ThesisLiveContext.Provider>
  );
}

/**
 * Access the full live context. Returns `null` when called outside a
 * `ThesisLiveProvider` — callers that want graceful degradation (e.g. TipTap
 * nodes rendered in the editor) can branch on null.
 */
export function useThesisLive(): ThesisLiveContextValue | null {
  return useContext(ThesisLiveContext);
}

/**
 * Per-object live stats. Returns `undefined` when:
 *   - no provider mounted (editor / preview contexts), OR
 *   - the id isn't present in the current payload (not yet polled, or not
 *     embedded in this thesis).
 *
 * Live nodes should fall back to their static `attrs` in those cases.
 */
export function useThesisLiveObject(
  id: string | null | undefined,
): LiveObjectStats | undefined {
  const ctx = useContext(ThesisLiveContext);
  if (!ctx || !id) return undefined;
  return ctx.payload?.objects?.[id];
}

/**
 * Convenience accessor for code that only needs to open the inspector.
 * Returns a no-op outside a provider.
 */
export function useOpenInspector(): (req: InspectorRequest) => void {
  const ctx = useContext(ThesisLiveContext);
  return ctx?.openInspector ?? (() => undefined);
}
