/**
 * IsonomiaWidget — deliberation-scope embeddable widget.
 *
 * Track AI-EPI Pt. 4 §6 — readiness-and-honesty posture for embeds.
 *
 * The widget surfaces (in order):
 *   1. The honesty floor (`DeliberationStateCard`)
 *   2. The contested frontier (`FrontierLane`) — read-only on this surface;
 *      "Open this thread" CTAs deep-link back to the deliberation page.
 *
 * This is intentionally minimal. The embeddable widget exists to push
 * the honesty floor and the frontier up to non-platform consumers; the
 * full DeepDivePanel lives at /deliberation/[id]. Anything richer
 * belongs there.
 *
 * The widget listens for the same `mesh:openComposer` / `mesh:deepdive:setTab`
 * events the in-app surface emits — when running embedded (no composer
 * mounted), the listener intercepts and navigates to the host
 * deliberation page with a query-string payload instead.
 */
"use client";

import * as React from "react";
import { useEffect } from "react";
import { DeliberationStateCard } from "@/components/deliberation/DeliberationStateCard";
import { FrontierLane } from "@/components/deliberation/FrontierLane";

type Props = {
  deliberationId: string;
  /**
   * Origin to deep-link to when a frontier-CTA fires inside the widget
   * (no composer is mounted). Defaults to the same origin.
   */
  hostOrigin?: string;
  /**
   * Visual density. `compact` shrinks the state-card; `default` is the
   * full layout used in /test/embeddable-widget pages.
   */
  density?: "default" | "compact";
};

export function IsonomiaWidget({
  deliberationId,
  hostOrigin,
  density = "default",
}: Props) {
  // The widget has no composer of its own. Intercept frontier CTAs and
  // open the host deliberation page in a new tab with a deep-link
  // payload — the host's DeepDivePanel listens for the same event.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const origin =
      hostOrigin ?? (typeof window !== "undefined" ? window.location.origin : "");
    const onOpenComposer = (e: Event) => {
      const detail = (e as CustomEvent).detail as Record<string, string> | undefined;
      if (!detail || detail.deliberationId !== deliberationId) return;
      // If we're embedded inside an iframe, asking the parent to navigate
      // is rude — open the deliberation in a new tab instead.
      const params = new URLSearchParams(
        Object.entries(detail).filter(([, v]) => typeof v === "string") as [string, string][],
      );
      const url = `${origin}/deliberation/${encodeURIComponent(deliberationId)}?${params.toString()}#composer`;
      window.open(url, "_blank", "noopener,noreferrer");
    };
    window.addEventListener("mesh:openComposer", onOpenComposer as EventListener);
    return () =>
      window.removeEventListener("mesh:openComposer", onOpenComposer as EventListener);
  }, [deliberationId, hostOrigin]);

  return (
    <div
      className="w-full max-w-4xl mx-auto space-y-3 p-4 cardv2 rounded-xl mt-8 "
      data-testid="isonomia-widget"
      data-deliberation-id={deliberationId}
    >
      <DeliberationStateCard
        deliberationId={deliberationId}
        density={density}
      />
      <FrontierLane deliberationId={deliberationId} limit={12} />
    </div>
  );
}

export default IsonomiaWidget;
