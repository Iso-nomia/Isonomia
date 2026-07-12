/**
 * Wayback Machine adapter for the Auto-Citation Engine.
 *
 * Phase 6 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * Two responsibilities:
 *
 *   1. `lookupArchiveSnapshot(url)` — query archive.org's
 *      `/wayback/available` endpoint to find the most recent snapshot
 *      of a URL. Used when the live URL is unreachable so we can still
 *      surface *something* citable, and when the URL is reachable but
 *      we want to record a stable archive copy alongside.
 *
 *   2. `requestArchiveCapture(url)` — fire-and-forget POST to
 *      `https://web.archive.org/save/<url>`. We do not wait for the
 *      capture to complete — this is purely a "please remember this for
 *      next time" request.
 *
 * Both are best-effort: every failure path returns `null`/`void`. The
 * resolver treats Wayback as enrichment, never as a precondition.
 */

import { acquireHostToken } from "./rateLimit";

const WAYBACK_AVAILABLE = "https://archive.org/wayback/available";
const WAYBACK_SAVE = "https://web.archive.org/save";

export interface ArchiveSnapshot {
  /** Fully-qualified Wayback URL, e.g. https://web.archive.org/web/20231104.../<orig>. */
  archiveUrl: string;
  /** ISO 8601 timestamp of the snapshot. */
  capturedAt: string;
  /** HTTP status the snapshot recorded. */
  status: string;
}

export async function lookupArchiveSnapshot(
  url: string,
  opts: { userAgent: string; timeoutMs?: number } = { userAgent: "MeshCitationResolver/0.1" },
): Promise<ArchiveSnapshot | null> {
  const ok = await acquireHostToken(WAYBACK_AVAILABLE);
  if (!ok) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6000);
  try {
    const res = await fetch(`${WAYBACK_AVAILABLE}?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": opts.userAgent, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      archived_snapshots?: { closest?: { available?: boolean; url?: string; timestamp?: string; status?: string } };
    };
    const snap = json.archived_snapshots?.closest;
    if (!snap?.available || !snap.url) return null;
    return {
      archiveUrl: snap.url.startsWith("http") ? snap.url : `https:${snap.url}`,
      capturedAt: parseWaybackTimestamp(snap.timestamp ?? ""),
      status: snap.status ?? "200",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fire-and-forget capture request. Resolves immediately; the actual
 * snapshot may take 30s+ on Wayback's side. Use `lookupArchiveSnapshot`
 * to verify later.
 */
export async function requestArchiveCapture(
  url: string,
  opts: { userAgent: string } = { userAgent: "MeshCitationResolver/0.1" },
): Promise<void> {
  // Don't wait for a token — capture is purely opportunistic.
  void (async () => {
    const ok = await acquireHostToken(WAYBACK_SAVE, { maxWaitMs: 1000 });
    if (!ok) return;
    try {
      await fetch(`${WAYBACK_SAVE}/${encodeURIComponent(url)}`, {
        method: "GET",
        headers: { "User-Agent": opts.userAgent },
      });
    } catch {
      /* best-effort */
    }
  })();
}

/** Wayback timestamps look like "20231104120103" → ISO 8601. */
function parseWaybackTimestamp(s: string): string {
  if (!/^\d{14}$/.test(s)) return new Date().toISOString();
  return new Date(
    Date.UTC(
      Number(s.slice(0, 4)),
      Number(s.slice(4, 6)) - 1,
      Number(s.slice(6, 8)),
      Number(s.slice(8, 10)),
      Number(s.slice(10, 12)),
      Number(s.slice(12, 14)),
    ),
  ).toISOString();
}
