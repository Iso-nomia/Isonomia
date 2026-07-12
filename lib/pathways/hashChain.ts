/**
 * Pathways — Hash chain
 *
 * Per-pathway append-only hash chain over `PathwayEvent` records.
 *
 * Chaining rule:
 *   hashChainSelf = sha256(
 *     (hashChainPrev ?? "") || "|" || canonicalJsonStringify(payload) || "|" || createdAtIso
 *   )
 *
 * Where `payload` is a stable view of the event (see `eventPayloadForHash`),
 * deliberately excluding the event's own `id` and `hashChainSelf` to avoid
 * circular dependence.
 *
 * Status: A0 scaffold. Uses Node's built-in `crypto`. Pure functions.
 */

import { createHash } from "crypto";
import { canonicalJsonStringify } from "./canonicalJson";
import type { PathwayEvent, PathwayEventInput } from "./types";

const SEP = "|";

/**
 * Stable subset of an event used as input to the hash. Excludes
 * `id`, `hashChainSelf`, and `hashChainPrev` (the chain inputs are
 * passed in separately).
 */
export interface HashableEventPayload {
  pathwayId: string;
  packetId: string | null;
  submissionId: string | null;
  responseId: string | null;
  eventType: string;
  actorId: string;
  actorRole: string | null;
  payloadJson: Record<string, unknown>;
}

export function eventPayloadForHash(input: PathwayEventInput): HashableEventPayload {
  return {
    pathwayId: input.pathwayId,
    packetId: input.packetId ?? null,
    submissionId: input.submissionId ?? null,
    responseId: input.responseId ?? null,
    eventType: input.eventType,
    actorId: input.actorId,
    actorRole: input.actorRole ?? null,
    payloadJson: input.payloadJson,
  };
}

/**
 * Compute `hashChainSelf` for a new event given its predecessor's hash and
 * its own canonical timestamp.
 *
 * @param prevHash null for the genesis (DRAFT_OPENED) event of a pathway.
 * @param payload  hashable subset of the event.
 * @param createdAt event creation timestamp (UTC).
 */
export function computeEventHash(
  prevHash: string | null,
  payload: HashableEventPayload,
  createdAt: Date,
): string {
  const prev = prevHash ?? "";
  const canonical = canonicalJsonStringify(payload);
  const ts = createdAt.toISOString();
  return createHash("sha256").update(prev + SEP + canonical + SEP + ts).digest("hex");
}

/**
 * Verify a single event's hash against its predecessor.
 */
export function verifyEventHash(event: PathwayEvent): boolean {
  const expected = computeEventHash(
    event.hashChainPrev,
    eventPayloadForHash(event),
    event.createdAt,
  );
  return expected === event.hashChainSelf;
}

export interface ChainVerificationResult {
  valid: boolean;
  /** Index of the first failing event, or -1 if all valid. */
  failedIndex: number;
  /** Reason for failure when `valid` is false. */
  reason?:
    | "EMPTY"
    | "GENESIS_PREV_NOT_NULL"
    | "PREV_HASH_MISMATCH"
    | "SELF_HASH_MISMATCH"
    | "OUT_OF_ORDER";
}

/**
 * Verify a complete chain of events for a single pathway.
 * Caller is responsible for ordering events by `createdAt` ascending and
 * filtering to a single `pathwayId`.
 */
export function verifyChain(events: PathwayEvent[]): ChainVerificationResult {
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
