/**
 * Evidence Provenance Hardening
 *
 * Track A.4 of the AI-Epistemic-Infrastructure Roadmap.
 *
 * When a `ClaimEvidence` row is created (typically by /api/arguments/quick),
 * we asynchronously fetch the source URL and capture:
 *   - sha256 of the response body
 *   - byte size, HTTP status, content-type, Last-Modified
 *   - a Wayback Machine snapshot URL (best-effort)
 *
 * The result is persisted on the `ClaimEvidence` row and surfaced in the
 * attestation envelope and JSON-LD. This is what lets an LLM citing an
 * Isonomia argument *prove* what the source said when the argument was made.
 *
 * Design notes:
 *   - Strict timeouts; never throws to the caller.
 *   - Body capture is capped (default 2 MiB) — we hash the captured slice.
 *     For larger pages this is still useful as a stable fingerprint of the
 *     opening of the document and remains deterministic across runs.
 *   - Archive request is fire-and-forget (Save Page Now is rate-limited and
 *     can take 30s+); we record the canonical Wayback URL pattern as soon
 *     as the request is accepted.
 */

import crypto from "crypto";
import { prisma } from "@/lib/prismaclient";

const FETCH_TIMEOUT_MS = 8_000;
// Save Page Now routinely needs 20–40 s to spider a fresh URL; 12 s
// guaranteed timeout failures on slow targets (nature.com, hhs.gov, etc.).
// 45 s gives SPN room while still capping worker latency.
const ARCHIVE_TIMEOUT_MS = 45_000;
const AVAILABILITY_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MiB cap
const USER_AGENT =
  "IsonomiaProvenanceBot/1.0 (+https://isonomia.app/bots; evidence attestation)";

// ============================================================
// TYPES
// ============================================================

export interface EvidenceProvenanceResult {
  ok: boolean;
  contentSha256: string | null;
  byteSize: number | null;
  contentType: string | null;
  httpStatus: number | null;
  lastModifiedAt: Date | null;
  archivedUrl: string | null;
  archivedAt: Date | null;
  error: string | null;
}

// ============================================================
// FETCH + HASH
// ============================================================

function isLikelyPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (h === "0.0.0.0" || h === "::1") return true;
  // Common RFC1918 v4 prefixes (string check is fine — hostnames are resolved by fetch)
  if (h.startsWith("10.") || h.startsWith("192.168.")) return true;
  if (h.startsWith("172.")) {
    const second = parseInt(h.split(".")[1] || "0", 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (h === "169.254.169.254") return true; // cloud metadata
  return false;
}

/**
 * Fetch the URL and capture provenance fields. Never throws.
 * Returns ok:false with an error message when fetch/timeout/policy fails.
 */
export async function fetchEvidenceProvenance(
  uri: string
): Promise<EvidenceProvenanceResult> {
  const empty: EvidenceProvenanceResult = {
    ok: false,
    contentSha256: null,
    byteSize: null,
    contentType: null,
    httpStatus: null,
    lastModifiedAt: null,
    archivedUrl: null,
    archivedAt: null,
    error: null,
  };

  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return { ...empty, error: "invalid_uri" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ...empty, error: "unsupported_protocol" };
  }
  if (isLikelyPrivateHost(url.hostname)) {
    return { ...empty, error: "private_host_blocked" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
      },
    });

    const httpStatus = res.status;
    const contentType = res.headers.get("content-type");
    const lastModifiedHeader = res.headers.get("last-modified");
    let lastModifiedAt: Date | null = null;
    if (lastModifiedHeader) {
      const parsed = new Date(lastModifiedHeader);
      if (!isNaN(parsed.getTime())) lastModifiedAt = parsed;
    }

    // Capture up to MAX_BODY_BYTES of the body for hashing.
    let totalBytes = 0;
    const hash = crypto.createHash("sha256");
    const reader = res.body?.getReader();
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        const remaining = MAX_BODY_BYTES - totalBytes;
        if (remaining <= 0) {
          try {
            await reader.cancel();
          } catch {}
          break;
        }
        const chunk =
          value.byteLength > remaining ? value.subarray(0, remaining) : value;
        hash.update(chunk);
        totalBytes += chunk.byteLength;
        if (totalBytes >= MAX_BODY_BYTES) {
          try {
            await reader.cancel();
          } catch {}
          break;
        }
      }
    } else {
      // Fallback: arrayBuffer (no streaming control); still bounded by server.
      const buf = new Uint8Array(await res.arrayBuffer());
      const slice = buf.byteLength > MAX_BODY_BYTES ? buf.subarray(0, MAX_BODY_BYTES) : buf;
      hash.update(slice);
      totalBytes = slice.byteLength;
    }

    return {
      ok: httpStatus >= 200 && httpStatus < 400,
      contentSha256: "sha256:" + hash.digest("hex"),
      byteSize: totalBytes,
      contentType,
      httpStatus,
      lastModifiedAt,
      archivedUrl: null,
      archivedAt: null,
      error: httpStatus >= 400 ? `http_${httpStatus}` : null,
    };
  } catch (err: any) {
    const msg =
      err?.name === "AbortError" ? "fetch_timeout" : (err?.message || "fetch_failed").slice(0, 200);
    return { ...empty, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// ARCHIVE.ORG SNAPSHOT
// ============================================================

/**
 * Best-effort Wayback Machine "Save Page Now" trigger.
 * Returns the canonical Wayback URL pattern when accepted.
 *
 * We don't block on the archive completing; we record the predictable
 * latest-snapshot URL `https://web.archive.org/web/{timestamp}/{uri}` and
 * also the timeless `https://web.archive.org/web/2/{uri}` which the
 * Wayback Machine resolves to the most recent snapshot.
 */
export async function requestArchiveSnapshot(
  uri: string
): Promise<{ archivedUrl: string | null; archivedAt: Date | null; error: string | null }> {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return { archivedUrl: null, archivedAt: null, error: "invalid_uri" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { archivedUrl: null, archivedAt: null, error: "unsupported_protocol" };
  }
  if (isLikelyPrivateHost(url.hostname)) {
    return { archivedUrl: null, archivedAt: null, error: "private_host_blocked" };
  }

  const saveUrl = `https://web.archive.org/save/${uri}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARCHIVE_TIMEOUT_MS);
  try {
    const res = await fetch(saveUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" },
    });

    // Wayback responds with various shapes. Prefer headers when present.
    // - 302 redirect to the snapshot lives in `Location`
    // - SPN sometimes uses `content-location` for an in-progress URL
    // - The Memento `Link` header carries rel="memento" pointers
    const location = res.headers.get("location");
    const contentLocation = res.headers.get("content-location");
    const link = res.headers.get("link");

    let archivedUrl: string | null = null;
    if (location && /https?:\/\/web\.archive\.org\/web\//i.test(location)) {
      archivedUrl = location;
    } else if (contentLocation && contentLocation.startsWith("/web/")) {
      archivedUrl = "https://web.archive.org" + contentLocation;
    } else if (link) {
      const m = link.match(/<(https:\/\/web\.archive\.org\/web\/[^>]+)>/i);
      if (m) archivedUrl = m[1];
    }

    if (!archivedUrl && res.status >= 200 && res.status < 400) {
      // Fallback to the timeless pointer; Wayback resolves this to the latest snapshot.
      archivedUrl = `https://web.archive.org/web/2/${uri}`;
    }

    return {
      archivedUrl,
      archivedAt: archivedUrl ? new Date() : null,
      error: archivedUrl ? null : `archive_http_${res.status}`,
    };
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? "archive_timeout"
        : (err?.message || "archive_failed").slice(0, 200);
    return { archivedUrl: null, archivedAt: null, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fallback to the Wayback availability API. When Save Page Now is slow or
 * fails, an existing snapshot may still be sitting in the Wayback Machine.
 * This is a cheap (~200 ms) JSON probe that returns the closest snapshot
 * URL if one exists, or null if Wayback has nothing on file.
 */
export async function lookupExistingArchive(
  uri: string,
): Promise<{ archivedUrl: string | null; archivedAt: Date | null; error: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AVAILABILITY_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(uri)}`,
      {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      },
    );
    if (res.status !== 200) {
      return { archivedUrl: null, archivedAt: null, error: `availability_http_${res.status}` };
    }
    const body = (await res.json()) as any;
    const snap = body?.archived_snapshots?.closest;
    if (snap?.available && typeof snap?.url === "string") {
      let archivedAt: Date | null = null;
      if (typeof snap.timestamp === "string" && /^\d{14}$/.test(snap.timestamp)) {
        const t = snap.timestamp;
        archivedAt = new Date(
          `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}Z`,
        );
      }
      return { archivedUrl: snap.url, archivedAt, error: null };
    }
    return { archivedUrl: null, archivedAt: null, error: "availability_no_snapshot" };
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? "availability_timeout"
        : (err?.message || "availability_failed").slice(0, 200);
    return { archivedUrl: null, archivedAt: null, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// PERSIST
// ============================================================

/**
 * Run provenance enrichment for a single ClaimEvidence row and persist
 * the result. Never throws. Returns the merged result for callers that
 * want to inspect it (tests, backfill scripts).
 *
 * Skips the row when `force=false` (default) and the row already has a
 * `contentSha256` from a previous run.
 */
export async function enrichEvidenceProvenance(
  evidenceId: string,
  opts: { force?: boolean; archive?: boolean } = {}
): Promise<EvidenceProvenanceResult | null> {
  const force = opts.force ?? false;
  const archive = opts.archive ?? true;

  const row = await prisma.claimEvidence.findUnique({
    where: { id: evidenceId },
    select: { id: true, uri: true, contentSha256: true } as any,
  } as any);
  if (!row) return null;
  if (!force && (row as any).contentSha256) return null;
  if (!row.uri) return null;

  const fetched = await fetchEvidenceProvenance(row.uri);
  let archived: Awaited<ReturnType<typeof requestArchiveSnapshot>> = {
    archivedUrl: null,
    archivedAt: null,
    error: null,
  };
  if (archive && fetched.ok) {
    archived = await requestArchiveSnapshot(row.uri);
    // Save Page Now is best-effort; on timeout, http error, or no snapshot
    // header, fall back to the cheap availability API. Catches the case where
    // Wayback already has a snapshot but SPN was too slow to confirm it.
    if (!archived.archivedUrl) {
      const fallback = await lookupExistingArchive(row.uri);
      if (fallback.archivedUrl) {
        archived = fallback;
      }
    }
  }

  const merged: EvidenceProvenanceResult = {
    ...fetched,
    archivedUrl: archived.archivedUrl,
    archivedAt: archived.archivedAt,
    error: fetched.error || archived.error,
  };

  try {
    await prisma.claimEvidence.update({
      where: { id: evidenceId },
      data: {
        contentSha256: merged.contentSha256,
        byteSize: merged.byteSize,
        contentType: merged.contentType,
        httpStatus: merged.httpStatus,
        lastModifiedAt: merged.lastModifiedAt,
        archivedUrl: merged.archivedUrl,
        archivedAt: merged.archivedAt,
        fetchedAt: new Date(),
        fetchError: merged.error,
      } as any,
    });
  } catch {
    // Persistence failure is non-fatal; provenance enrichment will retry on next access.
  }

  return merged;
}

/**
 * Fire-and-forget batch enrichment. Used by routes that just created a
 * batch of evidence rows and want to enrich without blocking the response.
 *
 * Caller must NOT await this. Errors are swallowed.
 */
export function enrichEvidenceProvenanceInBackground(
  evidenceIds: string[],
  opts: { force?: boolean; archive?: boolean } = {}
): void {
  if (!evidenceIds.length) return;
  // Detach from the request lifetime intentionally.
  void Promise.allSettled(
    evidenceIds.map((id) => enrichEvidenceProvenance(id, opts))
  ).catch(() => {});
}
