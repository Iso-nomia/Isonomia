/**
 * Commonplace background workers entrypoint.
 *
 * Run with: yarn workspace @app/commonplace worker
 *
 * Workers are added per-phase:
 *   Phase 1: plaintext extraction (currently inlined on save; can move here)
 *   Phase 4: periodic archive-state snapshots for long-view mode
 *   Phase 5: embedding generation for source/entry similarity
 *   Phase 7: PDF typesetting jobs
 */

console.log("[commonplace/worker] booted (no workers registered yet)");

// Keep the process alive so future Workers (BullMQ) can stay subscribed.
setInterval(() => {
  /* heartbeat */
}, 60_000);
