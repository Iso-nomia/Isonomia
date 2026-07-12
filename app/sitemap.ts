/**
 * Phase 3.1 / 3.2 \u2014 Sitemap for the public argument graph.
 *
 * Next.js 14's app-router sitemap convention. Returns a single sitemap
 * (the corpus is well below the 50k URL / 50 MB per-file ceiling that
 * forces a sitemap index). When that ceiling is in sight we'll switch
 * to a generated index under app/sitemaps/ \u2014 the entry shape stays
 * identical so consumers don't have to relearn anything.
 *
 * Entries:
 *   - the home page + the public search landing
 *   - every public argument permalink (rendered at /a/{shortCode})
 *   - every public claim by canonical MOID (/c/{moid})
 *   - canonical search topics: one row per argumentation scheme so
 *     `/search/arguments?scheme=expert_opinion` shows up as a discoverable
 *     surface in addition to the bare query landing.
 *
 * `lastModified` reflects the most recent meaningful change to that node:
 *   - argument: ArgumentPermalink.updatedAt (bumped when the graph state
 *     that defines its content hash changes)
 *   - claim: max(updatedAt, latest evidence/argument relating to it)
 *
 * Honest-empty: if Prisma is unreachable or returns nothing, the sitemap
 * still ships the static landing pages so crawlers see the surface even
 * during a DB blip.
 */
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";
// Cache for one hour at the edge \u2014 fresh enough that newly-shipped
// permalinks are crawlable within a working day, cheap enough that we
// don't punt the DB on every Googlebot heartbeat.
export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

// Hard cap so we don't blow the 50k URL ceiling. When the public corpus
// approaches this we'll add a sitemap index. Argument set is the only
// one that grows unboundedly; static + scheme entries are O(20).
const MAX_ARGUMENTS = 40_000;
const MAX_CLAIMS = 8_000;

// Canonical scheme keys we surface as discovery topics. Mirrors the
// datalist in components/search/SearchControls.tsx.
const KNOWN_SCHEMES = [
  "expert_opinion",
  "cause_to_effect",
  "analogy",
  "practical_reasoning",
  "position_to_know",
  "popular_opinion",
  "sign",
  "example",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static landings. Highest priority because they are the entry points
  // every other URL is reached from.
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/search/arguments`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    // Public, login-free explanation surfaces. Crawler-friendly entry
    // points a search engine or LLM reaches before any permalink.
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...[
      "/docs",
      "/docs/architecture",
      "/docs/argument-graph",
      "/docs/chrome-extension",
      "/docs/self-hosting",
      "/docs/privacy",
    ].map((path) => ({
      url: `${BASE_URL}${path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  // Scheme-scoped search topics \u2014 cheap to enumerate, gives Google
  // distinct landing pages per argumentation scheme.
  const schemeEntries: MetadataRoute.Sitemap = KNOWN_SCHEMES.map((key) => ({
    url: `${BASE_URL}/search/arguments?scheme=${encodeURIComponent(key)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  let argumentEntries: MetadataRoute.Sitemap = [];
  let claimEntries: MetadataRoute.Sitemap = [];

  try {
    const [permalinks, claims] = await Promise.all([
      prisma.argumentPermalink.findMany({
        select: { shortCode: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: MAX_ARGUMENTS,
      }),
      // Only surface claims with at least one public argument concluding
      // them \u2014 a claim with zero arguments has nothing to crawl into.
      prisma.claim.findMany({
        where: {
          asConclusion: { some: { permalink: { isNot: null } } },
        },
        select: { moid: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: MAX_CLAIMS,
      }),
    ]);

    argumentEntries = permalinks
      .filter((p) => !!p.shortCode)
      .map((p) => ({
        url: `${BASE_URL}/a/${encodeURIComponent(p.shortCode)}`,
        lastModified: p.updatedAt ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));

    claimEntries = claims
      .filter((c) => !!c.moid)
      .map((c) => ({
        url: `${BASE_URL}/c/${encodeURIComponent(c.moid as string)}`,
        lastModified: c.createdAt ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }));
  } catch {
    // Honest-empty on DB error \u2014 ship the static surface so crawlers
    // don't see an empty file. (Sitemap with zero <url> entries is a
    // validation error in some crawlers.)
  }

  return [...staticEntries, ...schemeEntries, ...argumentEntries, ...claimEntries];
}
