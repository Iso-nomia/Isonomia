/**
 * Typology / Meta-consensus — Hash chain
 *
 * Per-`(deliberationId, sessionId | null)` append-only hash chain over
 * `MetaConsensusEvent` records. Reuses the canonical-JSON + sha256
 * primitives from `lib/pathways/hashChain.ts` verbatim — only the
 * hashable payload shape differs.
 *
 * Chaining rule (identical to PathwayEvent / FacilitationEvent):
 *   hashChainSelf = sha256(
 *     (hashChainPrev ?? "") || "|" || canonicalJsonStringify(payload) || "|" || createdAtIso
 *   )
 */

import {
  computeEventHash as computeEventHashBase,
  type ChainVerificationResult,
  type HashableEventPayload,
} from "@/lib/pathways/hashChain";
import type {
  MetaConsensusEvent,
  MetaConsensusEventInput,
  MetaConsensusHashableEventPayload,
} from "./types";

/**
 * Meta-consensus variant of `computeEventHash`. Reuses the pathway
 * primitive verbatim — only the hashable payload shape differs, so the
 * canonical-JSON hashing is shape-agnostic at runtime.
 */
export function computeEventHash(
  prevHash: string | null,
  payload: MetaConsensusHashableEventPayload,
  createdAt: Date,
): string {
  return computeEventHashBase(
    prevHash,
    payload as unknown as HashableEventPayload,
    createdAt,
  );
}

export type { ChainVerificationResult } from "@/lib/pathways/hashChain";

export function eventPayloadForHash(
  input: MetaConsensusEventInput | MetaConsensusEvent,
): MetaConsensusHashableEventPayload {
  return {
    deliberationId: input.deliberationId,
    sessionId: input.sessionId ?? null,
    eventType: input.eventType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    payloadJson: input.payloadJson,
    tagId: input.tagId ?? null,
    summaryId: input.summaryId ?? null,
    candidateId: input.candidateId ?? null,
  };
}

export function verifyEventHash(event: MetaConsensusEvent): boolean {
  const expected = computeEventHash(
    event.hashChainPrev,
    eventPayloadForHash(event),
    event.createdAt,
  );
  return expected === event.hashChainSelf;
}

/**
 * Verify a complete chain for a single (deliberationId, sessionId | null)
 * scope. Caller is responsible for passing events sorted by `createdAt`
 * ascending and filtered to one chain scope.
 */
export function verifyChain(events: MetaConsensusEvent[]): ChainVerificationResult {
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
