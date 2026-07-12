/**
 * Typology — Facilitation event subscriber
 *
 * Subscribes to the Scope C facilitation event bus and feeds enabled
 * event-seeders. Each seeder's output is enqueued via
 * `candidateService.enqueueCandidate`; idempotency lives at the DB layer
 * (partial unique on `seedReferenceJson->>'facilitationEventId'`).
 *
 * Per the scope-b-handoff contract, this subscriber:
 *   • is best-effort and never throws back into the bus
 *   • is idempotent on `event.id` (re-fires from HMR / replay are no-ops)
 *   • re-reads authoritative state by id when it needs it
 *
 * Wire it once at app boot via `wireTypologyFacilitationSubscriber()`.
 *
 * Status: B1 scaffold.
 */

import { prisma } from "@/lib/prismaclient";
import {
  subscribeFacilitationEvents,
  type FacilitationEventEnvelope,
} from "@/lib/facilitation/eventBus";
import { FacilitationEventType } from "@/lib/facilitation/types";
import { enabledEventSeeders } from "../seeders";
import { enqueueCandidate } from "../candidateService";

const SUBSCRIBER_NAME = "typology.facilitationSeeder";

export interface WireOptions {
  featureFlags?: Record<string, boolean>;
  /**
   * Caller-injected env override. Defaults to `process.env`. Tested by
   * passing `{ MESH_TYPOLOGY_SEEDER_DISABLED: "1" }` to short-circuit.
   */
  env?: NodeJS.ProcessEnv;
}

export function wireTypologyFacilitationSubscriber(opts: WireOptions = {}): () => void {
  const env = opts.env ?? process.env;
  if (env.MESH_TYPOLOGY_SEEDER_DISABLED === "1") {
    // Explicit kill switch — useful in CI / migrations.
    // eslint-disable-next-line no-console
    console.info(`[${SUBSCRIBER_NAME}] disabled via MESH_TYPOLOGY_SEEDER_DISABLED`);
    return () => undefined;
  }
  const seeders = enabledEventSeeders(opts.featureFlags);
  if (seeders.length === 0) return () => undefined;

  const eventTypes = Array.from(
    new Set<FacilitationEventType>(
      seeders.flatMap((s) =>
        Array.from(s.eventTypes).map((t) => t as unknown as FacilitationEventType),
      ),
    ),
  );

  return subscribeFacilitationEvents(
    SUBSCRIBER_NAME,
    async (envelope) => {
      await handleEnvelope(envelope, seeders);
    },
    { eventTypes },
  );
}

async function handleEnvelope(
  envelope: FacilitationEventEnvelope,
  seeders: ReturnType<typeof enabledEventSeeders>,
): Promise<void> {
  const { event } = envelope;

  // Re-read deliberationId via the session — the published event payload
  // is authoritative but lacks deliberationId on the row itself.
  const session = await prisma.facilitationSession.findUnique({
    where: { id: event.sessionId },
    select: { deliberationId: true, status: true },
  });
  if (!session) return;

  for (const seeder of seeders) {
    if (!seeder.eventTypes.has(event.eventType as unknown as string)) continue;
    let output;
    try {
      output = seeder.run({ event });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[${SUBSCRIBER_NAME}] seeder "${seeder.name}" threw:`, err);
      continue;
    }
    if (!output) continue;

    try {
      await enqueueCandidate({
        deliberationId: session.deliberationId,
        sessionId: event.sessionId,
        targetType: output.targetType,
        targetId: output.targetId,
        suggestedAxisKey: output.suggestedAxisKey,
        seedSource: output.seedSource,
        seedReferenceJson: output.seedReferenceJson,
        rationaleText: output.rationaleText,
        priority: output.priority,
        ruleName: seeder.name,
        ruleVersion: seeder.version,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[${SUBSCRIBER_NAME}] enqueueCandidate failed for ${seeder.name} on event ${event.id}:`,
        err,
      );
    }
  }
}

export const _internal = { handleEnvelope, SUBSCRIBER_NAME };
