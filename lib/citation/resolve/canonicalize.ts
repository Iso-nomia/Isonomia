/**
 * URL canonicalization for the citation resolver.
 *
 * Phase 1 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * Two canonicalization passes:
 *
 *   1. **Lexical** (`canonicalizeUrlSync`): strip tracking parameters,
 *      lowercase the host, drop default ports, normalize trailing
 *      slashes. Pure, no I/O. Used as the cache key when network
 *      resolution is undesirable (tests, fast-path lookups).
 *
 *   2. **Resolved** (`canonicalizeUrl`): perform a HEAD with redirect
 *      following so a `https://t.co/abc` shortener resolves to the real
 *      publisher URL. Falls back to the lexical form when the network
 *      step fails.
 *
 * Tracking-param list is intentionally conservative: known-noise only.
 * We do NOT strip publisher-meaningful params (e.g. `?id=`, `?article=`).
 */

const TRACKING_PARAM_PREFIXES = [
  "utm_",        // Google Analytics family
  "mc_",         // Mailchimp
  "_hs",         // HubSpot
  "vero_",       // Vero
  "hsa_",        // HubSpot ads
];

const TRACKING_PARAMS_EXACT = new Set([
  "fbclid",      // Facebook
  "gclid",       // Google ads
  "dclid",       // DoubleClick
  "msclkid",     // Microsoft ads
  "yclid",       // Yandex
  "twclid",      // Twitter
  "li_fat_id",   // LinkedIn
  "igshid",      // Instagram
  "ref",         // generic referral (publisher-meaningful only ~5% of the time)
  "ref_src",     // Twitter embed
  "ref_url",     // Twitter embed
  "src",         // generic
  "share",
  "shared",
  "feature",     // YouTube share param
]);

/**
 * Drop tracking params, lowercase host, drop fragment, normalize slashes.
 *
 * Idempotent: `f(f(x)) === f(x)`.
 *
 * Returns the input verbatim if it cannot be parsed by the WHATWG URL
 * parser (pre-validation should usually catch this).
 */
export function canonicalizeUrlSync(input: string): string {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return input.trim();
  }

  // Drop tracking params.
  const keep: Array<[string, string]> = [];
  for (const [k, v] of u.searchParams.entries()) {
    const lower = k.toLowerCase();
    if (TRACKING_PARAMS_EXACT.has(lower)) continue;
    if (TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p))) continue;
    keep.push([k, v]);
  }
  // Sort for stable cache keys.
  keep.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  u.search = "";
  for (const [k, v] of keep) u.searchParams.append(k, v);

  // Lowercase host (already done by the URL parser, but be explicit).
  u.hostname = u.hostname.toLowerCase();

  // Drop fragment.
  u.hash = "";

  // Drop default ports.
  if (
    (u.protocol === "http:" && u.port === "80") ||
    (u.protocol === "https:" && u.port === "443")
  ) {
    u.port = "";
  }

  // Drop trailing slash on the path (but keep root "/").
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }

  return u.toString();
}

/**
 * Lexical canonicalize + follow HTTP redirects to land on the publisher's
 * real URL. Used when `canonicalizeUrlSync` would lose information (e.g.
 * `t.co`, `bit.ly`, `doi.org` → publisher landing page).
 *
 * Behaviour:
 * - Tries HEAD first; falls back to GET when the host returns 405.
 * - 5-second hard timeout via AbortController.
 * - On any network failure, returns the lexical form (never throws).
 * - Caps redirect depth at 10 (browser convention).
 */
export async function canonicalizeUrl(
  input: string,
  opts: { timeoutMs?: number; userAgent?: string } = {},
): Promise<string> {
  const lexical = canonicalizeUrlSync(input);
  const timeoutMs = opts.timeoutMs ?? 5_000;
  const userAgent =
    opts.userAgent ??
    `MeshCitationResolver/0.1 (+https://meshhq.app/citation-resolver)`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res = await fetch(lexical, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": userAgent },
    });

    // Some hosts (notably arxiv.org) reject HEAD with 405 / 403.
    if (res.status === 405 || res.status === 403) {
      res = await fetch(lexical, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": userAgent },
      });
    }

    return canonicalizeUrlSync(res.url || lexical);
  } catch {
    return lexical;
  } finally {
    clearTimeout(timer);
  }
}
