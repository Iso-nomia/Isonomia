// import "./reembed";
// import "./scrollRealtime";
import 'dotenv/config';
import '@/workers/reembed';
import "@/workers/scrollRealtime";

import "@/workers/decayConfidenceJob";
import "@/workers/computeSharedAuthorEdges";
import "@/workers/transport-aggregator";

// LUDICS Announcement Bus dispatcher — WS-5b (audit-log subscriber).
// Protocol: LUDICS_ANNOUNCEMENT_BUS_PROTOCOL.md §7.0.
import "@/workers/ludics/announcementDispatcher";

// Deferred Ludics Compile — debounced background recompile of a deliberation's
// derived Ludics/AIF view after record-only MCP moves.
// Roadmap: DEFERRED_LUDICS_COMPILE_ROADMAP.md §4 (Design A).
import "@/workers/ludics/compileWorker";

// ─────────────────────────────────────────────────────────
// Phase 3.1: Source Trust Infrastructure workers
// DISABLED during pre-launch development
// To re-enable: uncomment the imports below
// See: lib/sources/WORKERS_README.md for full documentation
// ─────────────────────────────────────────────────────────
// import "@/workers/sourceVerification";
// import "@/workers/sourceArchiving";


console.log('All workers bootstrapped');
