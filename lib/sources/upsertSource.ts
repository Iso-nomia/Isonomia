/**
 * lib/sources/upsertSource.ts
 *
 * Find-or-create a `Source` row from a URL or DOI. Used by the evidence
 * ingestion endpoint (B2.a) so the same DOI/URL ingested twice produces a
 * single Source.
 *
 * Dedup priority:
 *   1. doi (unique)
 *   2. url (unique)
 *   3. fingerprint (sha1 of canonicalized url|doi|title)
 *
 * Never throws on enrichment-style failures; only throws if the input is
 * structurally invalid (no url + no doi).
 */

import crypto from "crypto";
import { prisma } from "@/lib/prismaclient";

export type UpsertSourceInput = {
  url?: string | null;
  doi?: string | null;
  title?: string | null;
  authors?: string[] | null;
  publishedAt?: string | null; // ISO
  abstract?: string | null;
  keywords?: string[] | null;
  kind?: string | null; // defaults to "web" for url, "article" for doi
  createdById: string; // auth_id of provisioning user (orchestrator)
};

export type UpsertSourceResult = {
  source: {
    id: string;
    url: string | null;
    doi: string | null;
    title: string | null;
    contentHash: string | null;
    archiveUrl: string | null;
  };
  created: boolean;
};

/**
 * Canonicalize a URL for fingerprint-based dedup. Lowercases the host,
 * drops the fragment, sorts query params, strips common tracking params.
 * Never throws — returns the input unchanged on parse failure.
 */
function canonicalizeUrl(input: string): string {
  try {
    const u = new URL(input);
    u.hostname = u.hostname.toLowerCase();
    u.hash = "";
    const drop = new Set([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "mc_cid",
      "mc_eid",
      "ref",
      "ref_src",
    ]);
    const params = Array.from(u.searchParams.entries())
      .filter(([k]) => !drop.has(k.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b));
    u.search = "";
    for (const [k, v] of params) u.searchParams.append(k, v);
    // Strip trailing slash from path (but keep root "/")
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return input;
  }
}

function fingerprintFor(input: { url?: string | null; doi?: string | null; title?: string | null }): string {
  const basis = (input.doi?.toLowerCase() || (input.url ? canonicalizeUrl(input.url) : "") || (input.title ?? "")).trim();
  return crypto.createHash("sha1").update(basis).digest("hex");
}

function inferKind(input: UpsertSourceInput): string {
  if (input.kind) return input.kind;
  if (input.doi) return "article";
  return "web";
}

export async function upsertSourceFromUrlOrDoi(
  input: UpsertSourceInput
): Promise<UpsertSourceResult> {
  const url = input.url ? canonicalizeUrl(input.url) : null;
  const doi = input.doi?.trim() || null;
  if (!url && !doi) {
    throw new Error("upsertSource: at least one of `url` or `doi` is required");
  }

  // 1. Try DOI lookup
  if (doi) {
    const existing = await prisma.source.findUnique({
      where: { doi },
      select: { id: true, url: true, doi: true, title: true, contentHash: true, archiveUrl: true },
    });
    if (existing) return { source: existing, created: false };
  }

  // 2. Try URL lookup
  if (url) {
    const existing = await prisma.source.findUnique({
      where: { url },
      select: { id: true, url: true, doi: true, title: true, contentHash: true, archiveUrl: true },
    });
    if (existing) return { source: existing, created: false };
  }

  // 3. Try fingerprint lookup
  const fp = fingerprintFor({ url, doi, title: input.title });
  const existingByFp = await prisma.source.findFirst({
    where: { fingerprint: fp },
    select: { id: true, url: true, doi: true, title: true, contentHash: true, archiveUrl: true },
  });
  if (existingByFp) return { source: existingByFp, created: false };

  // 4. Create
  const year =
    input.publishedAt && !Number.isNaN(new Date(input.publishedAt).getTime())
      ? new Date(input.publishedAt).getUTCFullYear()
      : null;

  const created = await prisma.source.create({
    data: {
      kind: inferKind(input),
      title: input.title ?? null,
      authorsJson: input.authors?.length
        ? input.authors.map((a) => ({ family: a, given: null }))
        : undefined,
      year,
      doi,
      url,
      abstractText: input.abstract ?? null,
      keywords: input.keywords ?? [],
      fingerprint: fp,
      createdById: input.createdById,
    },
    select: { id: true, url: true, doi: true, title: true, contentHash: true, archiveUrl: true },
  });

  return { source: created, created: true };
}

export const __test__ = { canonicalizeUrl, fingerprintFor };
