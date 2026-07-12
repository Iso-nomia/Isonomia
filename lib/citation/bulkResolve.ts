/**
 * Client helper for bulk citation resolution (Phase 7).
 *
 * Posts to `/api/citations/resolve/bulk` and returns the per-URL
 * resolution records. Fire-and-forget by default — callers that don't
 * need the returned metadata can ignore the promise; the server will
 * still persist Source rows for any URL it can resolve.
 *
 * Two modes:
 *   - `bulkResolveCitations(urls)` waits for the JSON response.
 *   - `bulkResolveCitationsStreaming(urls, { onProgress })` opens an
 *     SSE stream so a UI can show per-row progress as URLs complete.
 */

export interface BulkResolveRecord {
  inputUrl: string;
  canonicalUrl: string;
  sourceId: string | null;
  doi?: string;
  title?: string;
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
  durationMs: number;
  warnings?: string[];
  archiveUrl?: string;
  archiveCapturedAt?: string;
}

export interface BulkResolveOptions {
  concurrency?: number;
  persistEmpty?: boolean;
  signal?: AbortSignal;
  endpoint?: string;
}

const DEFAULT_ENDPOINT = "/api/citations/resolve/bulk";

export async function bulkResolveCitations(
  urls: string[],
  opts: BulkResolveOptions = {},
): Promise<BulkResolveRecord[]> {
  const cleaned = urls.map((u) => u.trim()).filter(Boolean);
  if (cleaned.length === 0) return [];
  const res = await fetch(opts.endpoint ?? DEFAULT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      urls: cleaned,
      concurrency: opts.concurrency,
      persistEmpty: opts.persistEmpty,
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`bulkResolveCitations: HTTP ${res.status}`);
  const json = (await res.json()) as { results: BulkResolveRecord[] };
  return json.results;
}

export interface BulkResolveStreamOptions extends BulkResolveOptions {
  onProgress?: (event: {
    index: number;
    completed: number;
    total: number;
    record: BulkResolveRecord;
  }) => void;
  onStart?: (event: { total: number }) => void;
  onDone?: (event: { total: number; completed: number }) => void;
}

export async function bulkResolveCitationsStreaming(
  urls: string[],
  opts: BulkResolveStreamOptions = {},
): Promise<BulkResolveRecord[]> {
  const cleaned = urls.map((u) => u.trim()).filter(Boolean);
  if (cleaned.length === 0) return [];
  const res = await fetch(opts.endpoint ?? DEFAULT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      urls: cleaned,
      concurrency: opts.concurrency,
      persistEmpty: opts.persistEmpty,
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`bulkResolveCitationsStreaming: HTTP ${res.status}`);
  }

  const records: BulkResolveRecord[] = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // SSE messages are separated by \n\n.
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const raw = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const event = parseSseEvent(raw);
      if (!event) continue;
      switch (event.event) {
        case "start":
          opts.onStart?.(event.data);
          break;
        case "progress":
          records.push(event.data.record);
          opts.onProgress?.(event.data);
          break;
        case "done":
          opts.onDone?.(event.data);
          break;
      }
    }
  }
  return records;
}

function parseSseEvent(raw: string): { event: string; data: any } | null {
  let event = "message";
  let dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}
