"use client";

import * as React from "react";
import useSWR from "swr";
import clsx from "clsx";

/**
 * A3.6 — inline badge that surfaces "this claim/argument is included in
 * pathway packet vN forwarded to <institution>" on claim/argument cards.
 *
 * Designed to be slot-able next to a claim or argument identifier; consumers
 * pass `targetType` + `targetId` (matching `RecommendationPacketItem`).
 *
 * The endpoint is intentionally lightweight (`/api/pathways/lookup-by-target`)
 * so individual cards don't need a custom data layer. If the endpoint is not
 * yet implemented or returns an empty list, the badge silently renders nothing.
 */

export type PathwayBadgeTargetType =
  | "claim"
  | "argument"
  | "card"
  | "note";

type Hit = {
  pathwayId: string;
  pathwayStatus: string;
  packetVersion: number;
  institution: { id: string; name: string; kind: string };
};

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { items: [] }));

export interface PathwayBadgeProps {
  targetType: PathwayBadgeTargetType;
  targetId: string;
  className?: string;
  /** Limit how many institution chips to render before collapsing. */
  maxChips?: number;
}

export function PathwayBadge({
  targetType,
  targetId,
  className,
  maxChips = 2,
}: PathwayBadgeProps) {
  const { data } = useSWR<{ items: Hit[] }>(
    targetId
      ? `/api/pathways/lookup-by-target?targetType=${encodeURIComponent(
          targetType,
        )}&targetId=${encodeURIComponent(targetId)}`
      : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const hits = data?.items ?? [];
  if (hits.length === 0) return null;

  const visible = hits.slice(0, maxChips);
  const overflow = hits.length - visible.length;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 align-middle",
        className,
      )}
      title={`Forwarded to ${hits
        .map((h) => `${h.institution.name} (packet v${h.packetVersion})`)
        .join(", ")}`}
    >
      {visible.map((h) => (
        <a
          key={h.pathwayId}
          href={`/institutions/${h.institution.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-1.5 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-800 text-[10px] hover:bg-violet-100"
          onClick={(e) => e.stopPropagation()}
        >
          → {h.institution.name} v{h.packetVersion}
        </a>
      ))}
      {overflow > 0 && (
        <span className="px-1.5 py-0.5 rounded-full border bg-slate-50 text-slate-600 text-[10px]">
          +{overflow}
        </span>
      )}
    </span>
  );
}

export default PathwayBadge;
