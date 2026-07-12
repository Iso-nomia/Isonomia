/**
 * LUDICS Announcement Bus — v0 dispatcher worker.
 *
 * Protocol spec: Development and Ideation Documents/ARCHITECTURE/Ludics
 * Generative Substrate Documents/LUDICS_ANNOUNCEMENT_BUS_PROTOCOL.md (v0.2 §7.0).
 *
 * v0 ships as both the BullMQ worker AND the only subscriber (audit log).
 * Future workstreams split the audit-log subscriber out of this file when
 * a second subscriber lands (TODO[BUS.AUDIT-SPLIT] in protocol §7.1).
 *
 * Bootstrapping: self-registers on import via `workers/index.ts`, mirroring
 * the `workers/reembed.ts` pattern.
 */

import { Worker } from "bullmq";
import { prisma } from "@/lib/prismaclient";
import { connection } from "@/lib/queue";
import { AnnouncementEnvelope } from "@/lib/ludics/announcementBus";

export const SUBSTRATE_ANNOUNCEMENT_QUEUE = "substrate-announcement";

// ── Worker (audit-log subscriber, v0) ─────────────────────────────────────────

export const announcementDispatcher = new Worker(
  SUBSTRATE_ANNOUNCEMENT_QUEUE,
  async (job) => {
    const env = AnnouncementEnvelope.parse(job.data);

    // v0 subscriber: audit log (protocol §7.0).
    // eslint-disable-next-line no-console
    console.info({ event: "substrate_announcement", ...env });

    const eventId = (job.data as { eventId?: string }).eventId ?? job.name;
    if (eventId) {
      await prisma.substrateAnnouncement.update({
        where: { id: eventId },
        data: { deliveredAt: new Date() },
      });
    }
  },
  { connection, concurrency: 4 },
);

// ── Replay helper (protocol §6.1) ─────────────────────────────────────────────

/**
 * Re-enqueue persisted announcements that never made it onto the queue
 * (producer-side queue.add failure) or whose worker pass never marked
 * them delivered. Selects rows where `deliveredAt IS NULL` and
 * `occurredAt < now() - olderThanMs`.
 *
 * Scheduling on a cron is out of scope for v0 (TODO[BUS.SWEEP-CRON]);
 * this helper can be invoked from a future cron route under
 * `app/api/_cron/`.
 */
export async function replayUndelivered(olderThanMs = 5 * 60 * 1000): Promise<
  number
> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const rows = await prisma.substrateAnnouncement.findMany({
    where: { deliveredAt: null, occurredAt: { lt: cutoff } },
    select: {
      id: true,
      eventType: true,
      version: true,
      scopeId: true,
      actorParticipantId: true,
      subjectId: true,
      occurredAt: true,
      payload: true,
    },
    take: 500,
  });

  if (rows.length === 0) return 0;

  // Lazy-load the queue to mirror the bus's persist-only fallback.
  const { Queue } = await import("bullmq");
  const queue = new Queue(SUBSTRATE_ANNOUNCEMENT_QUEUE, { connection });
  try {
    for (const row of rows) {
      await queue.add(
        row.id,
        {
          eventId: row.id,
          eventType: row.eventType,
          version: row.version,
          scopeId: row.scopeId,
          actorParticipantId: row.actorParticipantId,
          subjectId: row.subjectId,
          occurredAt: row.occurredAt.toISOString(),
          payload: row.payload ?? {},
        },
        {
          attempts: 5,
          backoff: { type: "exponential" as const, delay: 1000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
    }
  } finally {
    await queue.close();
  }
  return rows.length;
}
