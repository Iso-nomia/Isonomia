/**
 * verify-mode-B v1b — source body-text retrieval for the backing check (C4).
 *
 * The resolver returns bibliographic metadata + (sometimes) an abstract, not full
 * body text. The NLI/LLM backing judge needs the source's actual prose as its
 * premise, so this fetches the source HTML and extracts the main readable text.
 * Honest ceiling: paywalled pages / PDFs / JS-rendered apps yield little or
 * nothing — callers fall back to the abstract, and failing that report the claim
 * as *unverifiable* (never "unsupported").
 *
 * `extractMainText` is pure (cheerio over an HTML string) and unit-tested;
 * `fetchSourceText` is the impure network shell (SSRF-guarded, timed, capped).
 */
import { load } from "cheerio";
import { isSafePublicUrl } from "@/lib/unfurl";

const MAX_HTML_BYTES = 2_000_000;
const MAX_TEXT_CHARS = 12_000;
const MIN_USEFUL_CHARS = 200;
const UA =
  process.env.CITATION_RESOLVER_USER_AGENT ??
  "MeshCitationResolver/0.1 (+https://meshhq.app/citation-resolver)";

/**
 * Extract the main readable text from an HTML document. Strips non-content
 * elements, prefers `<article>`/`<main>`, collapses whitespace, caps length.
 * Pure and synchronous.
 */
export function extractMainText(html: string): string {
  const $ = load(html);
  $("script, style, noscript, nav, header, footer, aside, form, svg, iframe").remove();
  const pick =
    $("article").first().text().trim() ||
    $("main").first().text().trim() ||
    $("body").text().trim() ||
    $.root().text().trim();
  return pick.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}

/**
 * Fetch a URL and return its raw HTML (capped), or `null` for SSRF-unsafe URLs,
 * non-HTML content (PDFs), or fetch failures. Shared by the body-text extractor
 * and the upstream-lineage extractor.
 */
export async function fetchHtml(url: string, opts: { timeoutMs?: number } = {}): Promise<string | null> {
  if (!isSafePublicUrl(url)) return null;
  const timeoutMs = opts.timeoutMs ?? 8_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*" },
    });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok || !ct.includes("html")) return null;
    return (await res.text()).slice(0, MAX_HTML_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface SourceTextResult {
  /** True when we retrieved enough body text to judge against. */
  ok: boolean;
  text: string;
  /** The URL actually fetched. */
  url: string;
}

/**
 * Fetch a source URL and extract its main text. Returns `ok: false` (empty text)
 * for SSRF-unsafe URLs, non-HTML content (PDFs), fetch failures, or documents
 * with too little extractable text — the caller then falls back to the abstract.
 */
export async function fetchSourceText(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<SourceTextResult> {
  const html = await fetchHtml(url, opts);
  if (html == null) return { ok: false, text: "", url };
  const text = extractMainText(html);
  return { ok: text.length >= MIN_USEFUL_CHARS, text, url };
}
