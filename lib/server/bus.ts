// lib/server/bus.ts
import { EventEmitter } from 'node:events'; // explicit Node entrypoint
import { BUS_EVENTS, type BusEvent } from '@/lib/events/topics';

/* ---------------------------- Typed payloads (extend as you go) ---------------------------- */
export interface BusPayloadMap {
  'dialogue:moves:refresh': { deliberationId: string; moveId?: string; kind?: string };
  'dialogue:cs:refresh':    { deliberationId: string; participantId?: string };
  'dialogue:changed':       { deliberationId: string; moveId?: string; kind?: string; chips?: string[] };
  // add more as you standardize them
}

export type BusPayload<T extends BusEvent> =
  T extends keyof BusPayloadMap ? BusPayloadMap[T] : Record<string, any>;

export type BusEnvelope<T extends BusEvent = BusEvent> =
  { type: T; ts: number } & BusPayload<T>;

  export type AgoraEvent = {
  id: string;            // stable id for UI keys
  type: BusEvent | "dialogue:changed"; // normalized
  ts: number;            // epoch ms
  title: string;         // card title / summary
  meta?: string;         // one-liner detail
  chips?: string[];      // tags/labels
  link?: string;         // primary link (room/claim)
  deliberationId?: string;
  targetType?: string;
  targetId?: string;
  icon?: string;         // "move"|"link"|"check"|"vote"|"branch"
};


/* ------------------------------- Global singleton ------------------------------- */
declare global {
  // eslint-disable-next-line no-var
  var __meshBus__: EventEmitter | undefined;
}
const bus: EventEmitter = globalThis.__meshBus__ ??= new EventEmitter();

// TEMP ceiling while migrating to one subscriber; remove later.
if ((EventEmitter as any).defaultMaxListeners < 50) {
  (EventEmitter as any).defaultMaxListeners = 50;
}
bus.setMaxListeners(50);

export default bus;

/* --------------------------------- Helpers --------------------------------- */

/**
 * Fire-and-forget durable write of an event envelope to AgoraOutbox.
 *
 * The in-memory ring buffer in `app/api/events/route.ts` remains the hot path
 * for SSE delivery; AgoraOutbox is a persistent shadow log used for replay,
 * audit, and (eventually) cross-instance fanout. Failures are swallowed so
 * the live event path is never affected.
 *
 * Disable with `MESH_AGORA_OUTBOX=off`.
 */
async function persistOutbox(env: BusEnvelope<any>): Promise<void> {
  if (process.env.MESH_AGORA_OUTBOX === "off") return;
  try {
    // Lazy import to avoid pulling Prisma into edge bundles or test setup
    // that may not have the client initialized at module load time.
    const { prisma } = await import("@/lib/prismaclient");
    const p: any = (env as any) ?? {};
    await (prisma as any).agoraOutbox.create({
      data: {
        ts: new Date(typeof p.ts === "number" ? p.ts : Date.now()),
        topic: String(env.type),
        roomId: typeof p.roomId === "string" ? p.roomId : null,
        deliberationId:
          typeof p.deliberationId === "string" ? p.deliberationId : null,
        targetType: typeof p.targetType === "string" ? p.targetType : null,
        targetId: typeof p.targetId === "string" ? p.targetId : null,
        payload: env as any,
        delivered: true, // in-process subscribers received it synchronously below
      },
    });
  } catch {
    // Swallow — outbox is best-effort. Never break the live bus.
  }
}

export function emitBus<T extends BusEvent>(type: T, payload: BusPayload<T>): BusEnvelope<T> {
  const env = { type, ts: Date.now(), ...(payload || {}) } as BusEnvelope<T>;
  bus.emit(type, env);
  // Fire-and-forget durable write; do not await.
  void persistOutbox(env);
  return env;
}

export function onBus<T extends BusEvent>(type: T, fn: (e: BusEnvelope<T>) => void) {
  bus.on(type, fn as any);
}

export function offBus<T extends BusEvent>(type: T, fn: (e: BusEnvelope<T>) => void) {
  (bus as any).off ? (bus as any).off(type, fn as any) : bus.removeListener(type, fn as any);
}

