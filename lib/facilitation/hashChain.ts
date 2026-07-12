/**
 * Facilitation — Hash chain
 *
 * Per-session append-only hash chain over `FacilitationEvent` records. Reuses
 * the canonical-JSON + sha256 primitives from `lib/pathways/hashChain.ts`
 * verbatim; only the hashable payload shape differs.
 *
 * Chaining rule (identical to PathwayEvent):
 *   hashChainSelf = sha256(
 *     (hashChainPrev ?? "") || "|" || canonicalJsonStringify(payload) || "|" || createdAtIso
 *   )
 */

import {
  computeEventHash,
  type ChainVerificationResult,
} from "@/lib/pathways/hashChain";
import type {
  FacilitationEvent,
  FacilitationEventInput,
  FacilitationHashableEventPayload,
} from "./types";

export { computeEventHash } from "@/lib/pathways/hashChain";
export type { ChainVerificationResult } from "@/lib/pathways/hashChain";

/**
 * Stable subset of a facilitation event used as input to the hash. Excludes
 * `id` and `hashChainSelf` (the chain inputs are passed in separately).
 */
export function eventPayloadForHash(
  input: FacilitationEventInput | FacilitationEvent,
): FacilitationHashableEventPayload {
  return {
    sessionId: input.sessionId,
    eventType: input.eventType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    payloadJson: input.payloadJson,
    interventionId: input.interventionId ?? null,
    metricSnapshotId: input.metricSnapshotId ?? null,
  };
}

export function verifyEventHash(event: FacilitationEvent): boolean {
  const expected = computeEventHash(
    event.hashChainPrev,
    eventPayloadForHash(event) as unknown as Parameters<typeof computeEventHash>[1],
    event.createdAt,
  );
  return expected === event.hashChainSelf;
}

/**
 * Verify a complete chain for a single session. Caller is responsible for
 * passing events sorted by `createdAt` ascending and filtered to one
 * `sessionId`.
 */
export function verifyChain(events: FacilitationEvent[]): ChainVerificationResult {
  if (events.length === 0) {
    return { valid: false, failedIndex: -1, reason: "EMPTY" };
  }

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (i === 0) {
      if (event.hashChainPrev !== null) {
        return { valid: false, failedIndex: i, reason: "GENESIS_PREV_NOT_NULL" };
      }
    } else {
      const prev = events[i - 1];
      if (prev.createdAt.getTime() > event.createdAt.getTime()) {
        return { valid: false, failedIndex: i, reason: "OUT_OF_ORDER" };
      }
      if (event.hashChainPrev !== prev.hashChainSelf) {
        return { valid: false, failedIndex: i, reason: "PREV_HASH_MISMATCH" };
      }
    }

    if (!verifyEventHash(event)) {
      return { valid: false, failedIndex: i, reason: "SELF_HASH_MISMATCH" };
    }
  }

  return { valid: true, failedIndex: -1 };
}
