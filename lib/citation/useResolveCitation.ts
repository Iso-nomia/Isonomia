/**
 * Client-side hook for the Auto-Citation Engine.
 *
 * Phase 5 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 *   const { state, data, error, refresh } = useResolveCitation(url, opts)
 *
 * Behaviour:
 *   - Debounces the input by `debounceMs` (default 350ms) — typing into
 *     a field will not flood the resolver.
 *   - Only calls the API for inputs that look like a URL (or `doi:` /
 *     bare `10.…/…` DOI). Garbage in → idle out.
 *   - Cancels in-flight requests on unmount or when the input changes.
 *   - Treats network errors as `state="error"` but does NOT throw; the
 *     chip falls back to a URL-only render in that case.
 *   - Skips while `enabled === false` so callers can pause resolution
 *     while a modal is closed, etc.
 */

"use client";

import * as React from "react";

export interface ResolvedCitationApi {
  sourceId: string;
  title: string | null;
  doi: string | null;
  url: string | null;
  year: number | null;
  authors: Array<{ family: string | null; given: string | null }>;
  container: string | null;
  publisher: string | null;
  pdfUrl: string | null;
}

export interface ResolveResponse {
  citation: ResolvedCitationApi | null;
  resolvedFrom:
    | "crossref"
    | "openalex"
    | "highwire"
    | "arxiv"
    | "wayback"
    | "llm"
    | "manual";
  enrichedBy: string[];
  confidence: "high" | "medium" | "low" | "none";
  cached: boolean;
  durationMs: number;
  warnings?: string[];
  archiveUrl?: string | null;
  archiveCapturedAt?: string | null;
}

export type ResolveState = "idle" | "loading" | "ready" | "error";

export interface UseResolveCitationOptions {
  debounceMs?: number;
  enabled?: boolean;
  /** Override the endpoint (mainly for testing). */
  endpoint?: string;
}

export interface UseResolveCitationResult {
  state: ResolveState;
  data: ResolveResponse | null;
  error: string | null;
  refresh: () => void;
}

const DOI_RX = /^(?:doi:)?(10\.\d{4,9}\/\S+)$/i;

function looksResolvable(input: string): boolean {
  if (!input) return false;
  const t = input.trim();
  if (t.length < 8) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (DOI_RX.test(t)) return true;
  return false;
}

function toResolverPayload(input: string): { url: string } | null {
  const t = input.trim();
  if (/^https?:\/\//i.test(t)) return { url: t };
  const doiMatch = t.match(DOI_RX);
  if (doiMatch) return { url: `https://doi.org/${doiMatch[1]}` };
  return null;
}

export function useResolveCitation(
  input: string,
  opts: UseResolveCitationOptions = {},
): UseResolveCitationResult {
  const { debounceMs = 350, enabled = true, endpoint = "/api/citations/resolve-url" } = opts;
  const [state, setState] = React.useState<ResolveState>("idle");
  const [data, setData] = React.useState<ResolveResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  // Reset to idle whenever the input changes to something un-resolvable.
  React.useEffect(() => {
    if (!enabled || !looksResolvable(input)) {
      setState("idle");
      setData(null);
      setError(null);
    }
  }, [input, enabled]);

  React.useEffect(() => {
    if (!enabled) return;
    const payload = toResolverPayload(input);
    if (!payload) return;

    setState("loading");
    setError(null);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok) {
          setState("error");
          setError(`HTTP ${res.status}`);
          return;
        }
        const json = (await res.json()) as ResolveResponse;
        setData(json);
        setState("ready");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // tick is intentionally a dep so refresh() refires.
  }, [input, enabled, debounceMs, endpoint, tick]);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);

  return { state, data, error, refresh };
}
