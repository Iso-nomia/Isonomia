/**
 * orchestrator/state/refresh.ts
 *
 * Composes the deliberation state from existing v3 endpoints. When the H2
 * bulk endpoint ships, this file collapses to a single call.
 *
 * Memoization is per-call-site (callers hold their own instance); we don't
 * cache across turns because the whole point of refresh is to see the
 * cumulative deliberation effect of the previous turn.
 */

import type { IsonomiaClient } from "../isonomia-client";
import type { IsonomiaCallContext } from "../isonomia-client";

export interface DeliberationState {
  fingerprint: unknown;
  frontier: unknown;
  missingMoves: unknown;
  chains: unknown;
  fetchedAt: string;
}

export async function fetchState(
  iso: IsonomiaClient,
  deliberationId: string,
  ctx: IsonomiaCallContext,
): Promise<DeliberationState> {
  // Run reads in parallel — they're all GETs against the same deliberation
  // and don't interact.
  const [fingerprint, frontier, missingMoves, chains] = await Promise.all([
    iso.getFingerprint(deliberationId, ctx),
    iso.getFrontier(deliberationId, ctx),
    iso.getMissingMoves(deliberationId, ctx),
    iso.getChains(deliberationId, ctx),
  ]);
  return {
    fingerprint,
    frontier,
    missingMoves,
    chains,
    fetchedAt: new Date().toISOString(),
  };
}
