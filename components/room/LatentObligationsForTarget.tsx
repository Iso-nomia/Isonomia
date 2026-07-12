// components/room/LatentObligationsForTarget.tsx
//
// Phase 4 / mount-spec — wrapper that bridges `(targetType, targetId)`
// surfaces (e.g. CriticalQuestionsV3) to the per-instance
// LatentObligationsPanel. Fetches the SchemeInstance rows attached to
// the target via /api/schemes/instances, filters to open ones, and
// renders one panel per instance.
//
// Mount anchor is keyed by target — NOT by ArgumentSchemeInstance.
// (ArgumentSchemeInstance is a separate model that links an Argument
// to an ArgumentScheme; SchemeInstance is the protocol-state row
// targeting a claim/card and is what Phase 4 close-gates.)

"use client";

import useSWR from "swr";
import { LatentObligationsPanel } from "./LatentObligationsPanel";

type InstanceRow = {
  id: string;
  schemeId: string;
  status: "open" | "closed" | "failed";
  closedAt: string | null;
  scheme: { key: string; name: string; summary: string | null };
};

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`fetch failed (${r.status})`);
    return r.json();
  });

export interface LatentObligationsForTargetProps {
  targetType: "claim" | "card";
  targetId: string;
  deliberationId: string;
  currentUserId: string;
  /** True if the current user is the author/proponent of the target. */
  isProponent?: boolean;
  /** Per spec §5.2, panel manages its own collapse state; this is an admin override. */
  defaultOpen?: boolean;
}

export function LatentObligationsForTarget(props: LatentObligationsForTargetProps) {
  const {
    targetType,
    targetId,
    deliberationId,
    currentUserId,
    isProponent = false,
    defaultOpen,
  } = props;

  // Only claim is currently supported by the listing endpoint.
  // (See app/api/schemes/instances/route.ts — card support is a follow-on.)
  const canQuery = targetType === "claim" && !!targetId && !!currentUserId;

  const { data, error } = useSWR<{ instances: InstanceRow[] }>(
    canQuery
      ? `/api/schemes/instances?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`
      : null,
    fetcher
  );

  if (!canQuery) return null;
  if (error) return null; // quiet — this is an informational surface, not a critical one
  if (!data) return null;

  const open = (data.instances ?? []).filter((i) => i.status === "open");
  if (open.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="latent-obligations-for-target">
      {open.map((inst) => (
        <LatentObligationsPanel
          key={inst.id}
          instanceId={inst.id}
          deliberationId={deliberationId}
          currentUserId={currentUserId}
          isProponent={isProponent}
          defaultOpen={defaultOpen}
        />
      ))}
    </div>
  );
}
