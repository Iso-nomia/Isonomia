/**
 * Typology / Meta-consensus — Outbound event bus
 *
 * Tiny in-process publish/subscribe layer over `MetaConsensusEvent` writes.
 * `typologyEventService.appendEvent` calls `publishMetaConsensusEvent` AFTER
 * the row is committed (best-effort; failures in subscribers are logged and
 * never propagate back to the originating write path).
 *
 * Mirrors `lib/facilitation/eventBus.ts` exactly — same contract, same
 * "register by name; replace on re-register; defensive subscribers" rules.
 */

import type { MetaConsensusEvent as PrismaMetaConsensusEvent } from "@prisma/client";
import { MetaConsensusEventType } from "./types";

export interface MetaConsensusEventEnvelope {
  schemaVersion: "1.0.0";
  publishedAt: Date;
  event: PrismaMetaConsensusEvent;
}

export type MetaConsensusEventSubscriber = (
  envelope: MetaConsensusEventEnvelope,
) => void | Promise<void>;

interface SubscriberRegistration {
  name: string;
  fn: MetaConsensusEventSubscriber;
  eventTypes?: ReadonlySet<MetaConsensusEventType>;
}

const subscribers: SubscriberRegistration[] = [];

export function subscribeMetaConsensusEvents(
  name: string,
  fn: MetaConsensusEventSubscriber,
  opts: { eventTypes?: MetaConsensusEventType[] } = {},
): () => void {
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

export function listMetaConsensusSubscribers(): readonly { name: string }[] {
  return subscribers.map((s) => ({ name: s.name }));
}

export async function publishMetaConsensusEvent(
  event: PrismaMetaConsensusEvent,
): Promise<void> {
  if (subscribers.length === 0) return;

  const envelope: MetaConsensusEventEnvelope = {
    schemaVersion: "1.0.0",
    publishedAt: new Date(),
    event,
  };
  const eventType = event.eventType as unknown as MetaConsensusEventType;

  const matches = subscribers.filter(
    (s) => !s.eventTypes || s.eventTypes.has(eventType),
  );

  await Promise.all(
    matches.map(async (sub) => {
      try {
        await sub.fn(envelope);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `[typology.eventBus] subscriber "${sub.name}" failed for ${event.eventType}:`,
          err,
        );
      }
    }),
  );
}

/** Test helper. Production code MUST NOT call this. Removes every subscriber. */
export function _resetMetaConsensusEventSubscribersForTest(): void {
  subscribers.length = 0;
}
