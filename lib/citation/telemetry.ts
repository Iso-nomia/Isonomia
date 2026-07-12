/**
 * Telemetry hooks for the Auto-Citation Engine (Phase 8).
 *
 * In-process counters + per-resolution log. We deliberately avoid a
 * heavy metrics dependency: this is a single Node process, the
 * resolver has bounded RPS, and the existing observability stack
 * (Datadog/etc.) isn't wired through `lib/`. Operators can scrape the
 * counters via the GET handler at `/api/citations/resolve/metrics`.
 *
 * Two surfaces:
 *
 *   recordResolution({ url, source, confidence, durationMs, cached })
 *     → bumps counters and writes a single structured log line.
 *
 *   getResolverMetrics()
 *     → snapshot of counters for the metrics endpoint.
 */

import type { Confidence, ResolverSource } from "./resolve/types";

interface Counters {
  total: number;
  cached: number;
  bySource: Record<ResolverSource, number>;
  byConfidence: Record<Confidence, number>;
  /** Sum of durationMs (use total - cached as denominator for live mean). */
  totalDurationMs: number;
  liveDurationMs: number;
  liveCount: number;
  /** When the process started accumulating. */
  startedAt: string;
}

const SOURCES: ResolverSource[] = [
  "crossref",
  "openalex",
  "highwire",
  "arxiv",
  "wayback",
  "llm",
  "manual",
];
const CONFIDENCES: Confidence[] = ["high", "medium", "low", "none"];

function emptyCounters(): Counters {
  return {
    total: 0,
    cached: 0,
    bySource: SOURCES.reduce((m, s) => ({ ...m, [s]: 0 }), {} as Record<ResolverSource, number>),
    byConfidence: CONFIDENCES.reduce((m, c) => ({ ...m, [c]: 0 }), {} as Record<Confidence, number>),
    totalDurationMs: 0,
    liveDurationMs: 0,
    liveCount: 0,
    startedAt: new Date().toISOString(),
  };
}

let counters = emptyCounters();

export interface ResolutionTelemetry {
  url: string;
  source: ResolverSource;
  confidence: Confidence;
  durationMs: number;
  cached: boolean;
  enrichedBy?: ResolverSource[];
  archived?: boolean;
}

export function recordResolution(t: ResolutionTelemetry): void {
  counters.total += 1;
  if (t.cached) counters.cached += 1;
  counters.bySource[t.source] = (counters.bySource[t.source] ?? 0) + 1;
  counters.byConfidence[t.confidence] = (counters.byConfidence[t.confidence] ?? 0) + 1;
  counters.totalDurationMs += t.durationMs;
  if (!t.cached) {
    counters.liveDurationMs += t.durationMs;
    counters.liveCount += 1;
  }

  // Single structured log line — easy to grep, easy to ship to a log
  // aggregator without hand-parsing prose.
  const line = JSON.stringify({
    evt: "citation.resolve",
    url: t.url,
    source: t.source,
    confidence: t.confidence,
    durationMs: t.durationMs,
    cached: t.cached,
    enrichedBy: t.enrichedBy?.length ? t.enrichedBy : undefined,
    archived: t.archived || undefined,
    ts: new Date().toISOString(),
  });
  // stderr in dev, stdout in prod — Next.js captures both. Use console.log
  // so it lands in Vercel/Cloud Run streams.
  console.log(line);
}

export function getResolverMetrics(): Counters & { meanLiveDurationMs: number; cacheHitRatio: number } {
  const meanLiveDurationMs = counters.liveCount ? counters.liveDurationMs / counters.liveCount : 0;
  const cacheHitRatio = counters.total ? counters.cached / counters.total : 0;
  return { ...counters, meanLiveDurationMs, cacheHitRatio };
}

/** Test/admin hook. */
export function _resetResolverMetrics(): void {
  counters = emptyCounters();
}
