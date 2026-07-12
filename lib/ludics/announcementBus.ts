/**
 * LUDICS Announcement Bus — v0 publish API.
 *
 * Protocol spec: Development and Ideation Documents/ARCHITECTURE/Ludics
 * Generative Substrate Documents/LUDICS_ANNOUNCEMENT_BUS_PROTOCOL.md (v0.2).
 *
 * - Persistence is the source of truth (`SubstrateAnnouncement`).
 * - BullMQ (`substrateAnnouncementQueue`) is the wake-up signal only.
 * - Idempotency triple: (eventType, subjectId, occurredAt).
 * - `publish(...)` is safe to retry: P2002 on the triple is swallowed.
 *
 * Producers MUST set `occurredAt` to the canonical action timestamp
 * (e.g. `witness.timestamp.toISOString()` or
 * `result.fossilizedAt.toISOString()`), NOT `new Date().toISOString()`
 * at the publish site. This keeps the idempotency triple stable across
 * re-emits.
 */

import { z } from "zod";
import { prisma } from "@/lib/prismaclient";

// ── Envelope ──────────────────────────────────────────────────────────────────

export const SubstrateEventType = z.enum([
  "witness_committed",
  "design_revealed",
  "witness_contested",
  "witness_rescinded",
]);
export type SubstrateEventType = z.infer<typeof SubstrateEventType>;

/**
 * Per-protocol §2. Field names match the v0.1 envelope (preserved across the
 * v0.2 transport revision) so subscribers do not churn.
 */
export const AnnouncementEnvelope = z.object({
  eventType: SubstrateEventType,
  version: z.literal(1).default(1),
  scopeId: z.string().min(1), // = deliberationId per WS-0
  actorParticipantId: z.string().nullable(),
  subjectId: z.string().min(1), // witnessId | designId
  occurredAt: z.string().datetime(),
  payload: z.record(z.unknown()).default({}),
});
export type AnnouncementEnvelope = z.infer<typeof AnnouncementEnvelope>;

/** Persisted shape (envelope + server-assigned id/insertedAt). */
export type PersistedAnnouncement = AnnouncementEnvelope & {
  id: string;
  insertedAt: Date;
  deliveredAt: Date | null;
};

// ── Publish ───────────────────────────────────────────────────────────────────

export type PublishResult =
  | { ok: true; eventId: string; deduped: false }
  | { ok: true; eventId: string | null; deduped: true };

/**
 * Persist + enqueue. Idempotent on the protocol's (eventType, subjectId,
 * occurredAt) triple. Returns `{ deduped: true }` on a repeat publish.
 *
 * Producers should wrap this in a try/catch at the emit seam — bus
 * failures MUST NOT fail the user-facing operation (protocol §5.3).
 */
export async function publishAnnouncement(
  input: AnnouncementEnvelope,
): Promise<PublishResult> {
  const env = AnnouncementEnvelope.parse(input);

  try {
    const row = await prisma.substrateAnnouncement.create({
      data: {
        eventType: env.eventType,
        version: env.version,
        scopeId: env.scopeId,
        actorParticipantId: env.actorParticipantId,
        subjectId: env.subjectId,
        occurredAt: new Date(env.occurredAt),
        payload: env.payload as any,
      },
      select: { id: true },
    });

    await enqueueAnnouncement(row.id, env);
    return { ok: true, eventId: row.id, deduped: false };
  } catch (err: any) {
    // P2002: unique constraint on (eventType, subjectId, occurredAt).
    // The triple is the protocol's dedupe key — treat as idempotent ok.
    if (isUniqueConstraintError(err)) {
      return { ok: true, eventId: null, deduped: true };
    }
    throw err;
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "P2002";
}

// ── Queue enqueue (lazy; safe at module load in tests) ────────────────────────

/**
 * Enqueue a job onto the substrate-announcement queue.
 *
 * `lib/queue.ts` throws on missing `UPSTASH_REDIS_URL` at import time, so we
 * lazy-resolve the queue here. Tests can `jest.mock("@/lib/ludics/announcementBus", ...)`
 * at the emit-site level, or `jest.mock("bullmq", ...)` + `jest.mock("@/lib/queue", ...)`
 * for bus-internal tests. Production behavior is unchanged.
 *
 * If queue enqueue throws, the row is already persisted — the dispatcher's
 * `replayUndelivered()` sweep (protocol §6.1) will pick it up.
 */
async function enqueueAnnouncement(
  eventId: string,
  env: AnnouncementEnvelope,
): Promise<void> {
  const queue = await getSubstrateAnnouncementQueue();
  if (!queue) return; // queue unavailable (e.g. test env) — DB row still wins via replay sweep
  await queue.add(eventId, { eventId, ...env }, defaultJobOpts());
}

export function defaultJobOpts() {
  // Protocol §5.1
  return {
    attempts: 5,
    backoff: { type: "exponential" as const, delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  };
}

let _queuePromise: Promise<unknown> | null = null;

async function getSubstrateAnnouncementQueue(): Promise<{
  add: (name: string, data: unknown, opts?: unknown) => Promise<unknown>;
} | null> {
  if (!_queuePromise) {
    _queuePromise = (async () => {
      try {
        const { Queue } = await import("bullmq");
        const { connection } = await import("@/lib/queue");
        return new Queue("substrate-announcement", { connection });
      } catch (err) {
        // Connection unavailable (e.g. test env without UPSTASH_REDIS_URL).
        // Persist-only mode: the row is the source of truth; the sweeper
        // will enqueue later. See protocol §5.3 / §6.1.
        if (process.env.NODE_ENV !== "test") {
          // eslint-disable-next-line no-console
          console.warn(
            "[announcementBus] queue init failed; running persist-only",
            err,
          );
        }
        return null;
      }
    })();
  }
  return _queuePromise as Promise<{
    add: (name: string, data: unknown, opts?: unknown) => Promise<unknown>;
  } | null>;
}

/** Test helper: reset memoized queue. */
export function __resetAnnouncementBusForTests(): void {
  _queuePromise = null;
}
