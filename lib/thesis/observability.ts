// lib/thesis/observability.ts
//
// Living Thesis — Phase 7.1: lightweight polling instrumentation.
//
// Reader endpoints (/live, /attacks, /confidence, /inspect/...) call
// `logReaderPoll` to emit a single structured log line per request. The
// signal we care about for the SSE upgrade trigger (D3 in
// docs/LIVING_THESIS_DEFERRED.md) is:
//
//   • `latencyMs`    — how long the handler spent assembling the payload
//   • `payloadBytes` — JSON byte length of the body
//   • `objectCount`  — number of embedded objects in the response (when
//     applicable; helps us spot pathologically large theses)
//   • `staleMs`      — wall time between the request and the payload's
//     reported `lastChangedAt`/`cursor` (proxy for "how long has the
//     reader been holding stale data?")
//   • `requestId`    — best-effort id pulled from `x-request-id` /
//     `x-vercel-id` so the line can be correlated with downstream traces
//
// Output is intentionally `console.info` JSON — the platform's log
// aggregator picks it up unmodified, and Phase 7.4 lists structured
// metrics emission as the next-step deferred item.
//
// Set `LIVING_THESIS_OBS_VERBOSE=1` to also include a compact summary of
// counts buckets for the /live endpoint. Otherwise we keep the line short.

import type { NextRequest } from "next/server";

export interface ReaderPollLog {
  endpoint:
    | "thesis.live"
    | "thesis.attacks"
    | "thesis.confidence"
    | "thesis.inspect"
    | "thesis.focus"
    | "thesis.backlinks";
  thesisId: string;
  authId?: string | null;
  latencyMs: number;
  payloadBytes: number;
  objectCount?: number;
  staleMs?: number;
  cursor?: string | null;
  status: number;
  requestId?: string;
  extra?: Record<string, unknown>;
}

function pickRequestId(req?: NextRequest | Request): string | undefined {
  if (!req) return undefined;
  const h = (req as any).headers as Headers;
  return (
    h.get("x-request-id") ??
    h.get("x-vercel-id") ??
    h.get("cf-ray") ??
    undefined
  );
}

/**
 * Compute the byte length of a JSON-serialisable body without paying the
 * full re-serialise cost twice. We accept either a pre-stringified body
 * (when the handler already has it) or an object we need to measure.
 */
export function payloadBytes(value: unknown): { bytes: number; serialized: string } {
  const serialized =
    typeof value === "string" ? value : JSON.stringify(value ?? null);
  // Buffer.byteLength is only meaningful for the eventual UTF-8 wire size.
  const bytes = Buffer.byteLength(serialized, "utf8");
  return { bytes, serialized };
}

export function logReaderPoll(entry: ReaderPollLog & { req?: NextRequest | Request }) {
  const { req, ...rest } = entry;
  const line = {
    msg: "thesis.reader.poll",
    ts: new Date().toISOString(),
    requestId: rest.requestId ?? pickRequestId(req),
    ...rest,
  };
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(line));
}

/**
 * Convenience wrapper used by route handlers that build a JSON body and
 * want to emit a single instrumentation line + return the response. It
 * keeps every reader endpoint's epilogue identical.
 */
export function instrumentReaderResponse<T>(opts: {
  endpoint: ReaderPollLog["endpoint"];
  thesisId: string;
  authId?: string | null;
  startedAt: number;
  body: T;
  status?: number;
  cursor?: string | null;
  /** ISO timestamp the data was last considered "fresh"; used for staleMs. */
  freshAt?: string | null;
  objectCount?: number;
  req?: NextRequest | Request;
  extra?: Record<string, unknown>;
}): { serialized: string; latencyMs: number; bytes: number } {
  const latencyMs = Math.max(0, Date.now() - opts.startedAt);
  const { bytes, serialized } = payloadBytes(opts.body);
  const staleMs = opts.freshAt
    ? Math.max(0, Date.now() - new Date(opts.freshAt).getTime())
    : undefined;

  logReaderPoll({
    endpoint: opts.endpoint,
    thesisId: opts.thesisId,
    authId: opts.authId ?? null,
    latencyMs,
    payloadBytes: bytes,
    objectCount: opts.objectCount,
    staleMs,
    cursor: opts.cursor ?? null,
    status: opts.status ?? 200,
    extra: opts.extra,
    req: opts.req,
  });

  return { serialized, latencyMs, bytes };
}
