/**
 * Facilitation — Outbound event bus (C4.4)
 *
 * Tiny in-process publish/subscribe layer over `FacilitationEvent` writes.
 * `eventService.appendEvent` calls `publishFacilitationEvent` AFTER the
 * row is committed (best-effort; failures in subscribers are logged and
 * never propagate back to the originating write path).
 *
 * Contract — see also `docs/facilitation/scope-b-handoff.md`:
 *
 *   • Subscribers receive every event type. They MUST filter themselves.
 *   • Delivery is in-process and synchronous in registration order.
 *     Subscribers MUST NOT block on remote I/O; if they need to do work
 *     off the request path, they should enqueue to BullMQ themselves.
 *   • Delivery is at-most-once — there is no replay buffer. For replay,
 *     consumers should poll `/api/facilitation/sessions/:id/events`.
 *   • Schema for the published payload is the same shape as the row in
 *     the DB; field additions are non-breaking, removals are breaking.
 *   • Errors thrown by subscribers are caught and logged; the row write
 *     has already been durably committed when subscribers run.
 *
 * Scope B will subscribe to `INTERVENTION_APPLIED` and
 * `METRIC_THRESHOLD_CROSSED` to seed disagreement-typology candidates.
 * No Scope B-specific shape lands here (per C4 risk mitigation).
 */

import type { FacilitationEvent as PrismaFacilitationEvent } from "@prisma/client";
import { FacilitationEventType } from "@/lib/facilitation/types";

export interface FacilitationEventEnvelope {
  /** Stable schema marker for downstream consumers. */
  schemaVersion: "1.0.0";
  publishedAt: Date;
  event: PrismaFacilitationEvent;
}

export type FacilitationEventSubscriber = (
  envelope: FacilitationEventEnvelope,
) => void | Promise<void>;

interface SubscriberRegistration {
  name: string;
  fn: FacilitationEventSubscriber;
  /** If non-empty, subscriber is only called for matching event types. */
  eventTypes?: ReadonlySet<FacilitationEventType>;
}

const subscribers: SubscriberRegistration[] = [];

/**
 * Register a subscriber. Returns an unsubscribe function. Subscribers are
 * keyed by `name`; re-registering the same name replaces the prior one
 * (handy for HMR + tests).
 */
export function subscribeFacilitationEvents(
  name: string,
  fn: FacilitationEventSubscriber,
  opts: { eventTypes?: FacilitationEventType[] } = {},
): () => void {
  // Replace existing registration with the same name
  const existing = subscribers.findIndex((s) => s.name === name);
  const reg: SubscriberRegistration = {
    name,
    fn,
    ...(opts.eventTypes ? { eventTypes: new Set(opts.eventTypes) } : {}),
  };
  if (existing >= 0) subscribers.splice(existing, 1, reg);
  else subscribers.push(reg);

  return () => {
    const idx = subscribers.findIndex((s) => s.name === name);
    if (idx >= 0) subscribers.splice(idx, 1);
  };
}

/**
 * Snapshot of registered subscribers; intended for tests/diagnostics.
 */
export function listFacilitationSubscribers(): readonly { name: string }[] {
  return subscribers.map((s) => ({ name: s.name }));
}

/**
 * Publish an event to all matching subscribers. Subscriber errors are
 * caught and logged; they NEVER propagate to the caller.
 *
 * Returns a promise that resolves when every subscriber has settled. The
 * caller may safely fire-and-forget.
 */
export async function publishFacilitationEvent(
  event: PrismaFacilitationEvent,
): Promise<void> {
  if (subscribers.length === 0) return;

  const envelope: FacilitationEventEnvelope = {
    schemaVersion: "1.0.0",
    publishedAt: new Date(),
    event,
  };
  const eventType = event.eventType as unknown as FacilitationEventType;

  const matches = subscribers.filter(
    (s) => !s.eventTypes || s.eventTypes.has(eventType),
  );

  await Promise.all(
    matches.map(async (sub) => {
      try {
        await sub.fn(envelope);
      } catch (err) {
        // Best-effort logging — never re-throw.
        // eslint-disable-next-line no-console
        console.error(
          `[facilitation.eventBus] subscriber "${sub.name}" failed for ${event.eventType}:`,
          err,
        );
      }
    }),
  );
}

/**
 * Test helper. Exported but intentionally undocumented in the contract —
 * production code MUST NOT call this. Removes every subscriber.
 */
export function _resetFacilitationEventSubscribersForTest(): void {
  subscribers.length = 0;
}
