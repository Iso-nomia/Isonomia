/**
 * lib/chains/essayPolish.ts
 *
 * M6 — LLM polish pass for chain essays (behind feature flag).
 *
 * Contract (per `docs/Chain Essay Prose Generator dev roadmap.md` §M6):
 *
 *   - Input: `{ chain, deterministicProse, tone, audience, standingsSummary,
 *              chainId, contentHash, modelId? }`.
 *   - The LLM is constrained to *rewrite for fluency* only. It must not
 *     introduce facts, citations, claims, or numerics absent from
 *     `deterministicProse`, and it must preserve every hedge.
 *   - A post-pass fact-preservation guard diffs the polished output against
 *     the input. Any new proper-noun / numeric / citation token triggers a
 *     fall-back to the deterministic prose (no polish applied).
 *   - The polished text is cached in Upstash Redis under key
 *     `chain:polish:v1:<chainId>:<contentHash>:<tone>:<audience>:<modelId>`
 *     with the same 300s TTL used for the synthetic-readout L1 cache.
 *   - Gated on `isChainEssayPolishEnabled()` — env `CHAIN_ESSAY_LLM_POLISH=1`
 *     plus an optional per-deliberation override map.
 *
 * Note: the rule-based generator remains the canonical deterministic
 * skeleton. With the flag off, behaviour is byte-identical to M4 because
 * `polishEssay` is only invoked from view code that opts in.
 */

import OpenAI from "openai";
import { tryGetUpstashRedis } from "@/lib/upstash";
import type { ToneStrategy } from "@/lib/chains/toneStrategy";
import { resolveToneStrategy } from "@/lib/chains/toneStrategy";

// ============================================================
// Feature flag
// ============================================================

/**
 * Per-deliberation overrides (e.g. dogfood a single room). Map id → on/off.
 * Populated at process start from `CHAIN_ESSAY_LLM_POLISH_DELIBERATIONS`
 * (comma-separated list of `<id>=on|off` pairs).
 */
const POLISH_OVERRIDES: Map<string, boolean> = (() => {
  const raw = process.env.CHAIN_ESSAY_LLM_POLISH_DELIBERATIONS ?? "";
  const out = new Map<string, boolean>();
  for (const pair of raw.split(",")) {
    const [id, val] = pair.split("=").map((s) => s.trim());
    if (!id) continue;
    out.set(id, val === "on" || val === "1" || val === "true");
  }
  return out;
})();

export function isChainEssayPolishEnabled(opts?: {
  deliberationId?: string | null;
}): boolean {
  const id = opts?.deliberationId ?? null;
  if (id && POLISH_OVERRIDES.has(id)) return POLISH_OVERRIDES.get(id) === true;
  const env = process.env.CHAIN_ESSAY_LLM_POLISH;
  return env === "1" || env === "true" || env === "on";
}

// ============================================================
// Inputs / outputs
// ============================================================

export interface ChainStandingsSummary {
  /** One-line description of the chain's standings narrative (e.g.
   * "two of A's supporting arguments stand; B's methodological critique
   * fell; one residual qualifier remains open"). Usually `chain.purpose`
   * or a rendering of `conclusionSynthesisInputs`. */
  oneLiner: string;
  survivingCount: number;
  fallenCount: number;
  residualCount: number;
  /** Optional refusal-banner line; if present the polish prompt is told
   * to *preserve it verbatim* in the final paragraph. */
  refusalBanner?: string;
}

export interface PolishInput {
  chainId: string;
  /** Stable hash of the chain projection that produced `deterministicProse`.
   * Drives cache invalidation alongside tone/audience/model. */
  contentHash: string;
  /** Optional purpose field from the chain — woven into the prompt to give
   * the LLM the standings narrative (item 12). */
  chainPurpose?: string | null;
  /** Deterministic essay text. Source of truth for facts. */
  deterministicProse: string;
  tone: "academic" | "journalistic" | "deliberative" | "persuasive";
  audience: "general" | "informed" | "expert";
  standingsSummary: ChainStandingsSummary;
  /** Optional override; defaults to `gpt-4o-mini`. */
  modelId?: string;
  /** Optional deliberationId for per-room flag overrides. */
  deliberationId?: string | null;
  /** Manual-trigger escape hatch. When `true`, bypass the
   * `isChainEssayPolishEnabled` gate — used by the in-UI "Polish with
   * AI" button so curators can invoke a one-off polish even when the
   * env flag is off. Still requires valid `OPENAI_API_KEY`; on missing
   * credentials the function returns `usedPolish:false, reason:"missing_credentials"`. */
  force?: boolean;
}

export interface PolishResult {
  polished: string;
  /** True if the LLM polish was applied; false if we fell back to
   * deterministic (flag off, cache miss + no key, fact-guard tripped,
   * or LLM error). */
  usedPolish: boolean;
  /** When `usedPolish === false`, the reason. */
  reason?:
    | "flag_off"
    | "cache_hit"
    | "fact_guard_tripped"
    | "llm_error"
    | "missing_credentials"
    | "empty_response";
  /** Tokens added by the LLM that did not appear in the input — only
   * populated when `reason === "fact_guard_tripped"`. */
  introducedTokens?: string[];
}

// ============================================================
// Fact-preservation guard
// ============================================================

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "of", "in",
  "on", "at", "to", "from", "by", "for", "with", "without", "into", "onto",
  "as", "is", "are", "was", "were", "be", "been", "being", "this", "that",
  "these", "those", "it", "its", "we", "our", "you", "your", "they", "their",
  "i", "he", "she", "his", "her", "him", "them", "us", "me", "my", "so",
  "not", "no", "yes", "do", "does", "did", "have", "has", "had", "can",
  "could", "should", "would", "may", "might", "must", "shall", "will",
  "however", "moreover", "furthermore", "therefore", "thus", "hence",
  "indeed", "rather", "still", "yet", "while", "whereas", "although",
  "though", "because", "since", "when", "where", "what", "which", "who",
  "whom", "whose", "how", "why", "all", "any", "some", "none", "each",
  "every", "either", "neither", "both", "few", "many", "much", "most",
  "more", "less", "least", "such", "than", "also", "even", "only", "just",
  "very", "well", "here", "there", "now", "later", "again", "further",
  "first", "second", "third", "last", "next", "before", "after", "during",
  "under", "over", "above", "below", "between", "among", "through",
]);

/**
 * Normalize a token for set-membership comparison. Lowercases, strips
 * trailing punctuation (preserving `%` since it carries fact-bearing
 * meaning in numerics like `12%`), collapses curly quotes.
 */
function normalizeToken(t: string): string {
  return t
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, "");
}

/**
 * Extract fact-bearing tokens worth guarding:
 *   - Proper nouns (capitalized words not at sentence start, plus all
 *     capitalized non-stopword tokens — we err on the inclusive side).
 *   - Numerics (integers, decimals, percentages, years).
 *   - Citation-shaped tokens (parenthetical year refs like `(2023)`,
 *     bracketed numerics like `[12]`, DOI/URL prefixes).
 *
 * Returns a *Set* of normalized strings.
 */
export function extractFactTokens(text: string): Set<string> {
  const out = new Set<string>();
  if (!text) return out;

  // Proper-noun-ish: tokens with at least one internal capital after
  // the first char, or all-caps tokens ≥2 chars.
  const properNounRe = /\b([A-Z][A-Za-z0-9'\-]*(?:\s+[A-Z][A-Za-z0-9'\-]*)*)/g;
  for (const m of text.matchAll(properNounRe)) {
    const raw = m[1];
    // Split multiword spans; each capitalized component is a token.
    for (const part of raw.split(/\s+/)) {
      const norm = normalizeToken(part);
      if (!norm) continue;
      if (STOPWORDS.has(norm)) continue;
      // Skip single capital letters used as variables like "A" / "B"
      // *unless* they're the entire token (still keep — caller may
      // refer to "Argument A").
      out.add(norm);
    }
  }

  // Numerics: integers, decimals, percentages, years. Trailing `%` is
  // captured greedily before the word-boundary check (which would
  // otherwise fire between `5` and `%`).
  const numericRe = /\b\d+(?:[.,]\d+)?%?/g;
  for (const m of text.matchAll(numericRe)) {
    out.add(normalizeToken(m[0]));
  }

  // Citation-shaped tokens.
  const citationRe = /\(\s*\d{4}[a-z]?\s*\)|\[\s*\d+\s*\]|doi:\s*\S+|https?:\/\/\S+/gi;
  for (const m of text.matchAll(citationRe)) {
    out.add(normalizeToken(m[0]));
  }

  // Spelled-out cardinals (case-insensitive). Without this, a polish that
  // sentence-initial-capitalizes "Three" trips the proper-noun branch
  // while the deterministic mid-sentence "three" is skipped, producing
  // a false positive. We normalize all variants ("Three", "three",
  // "THREE") to a single canonical form so case mismatches don't flag,
  // while a genuine drift (polish "four" vs deterministic "three") still
  // surfaces as an introduced token.
  const NUMBER_WORDS = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
  ];
  const numberWordRe = new RegExp(`\\b(${NUMBER_WORDS.join("|")})\\b`, "gi");
  for (const m of text.matchAll(numberWordRe)) {
    out.add(`num:${m[1].toLowerCase()}`);
  }
  // Also strip any bare-cased variants of these words that may have
  // landed via the proper-noun branch, so the set contains only the
  // canonical `num:<word>` form for cardinals.
  for (const w of NUMBER_WORDS) {
    out.delete(w);
  }

  return out;
}

/**
 * Diff fact tokens: returns tokens in `polished` that are *not* in
 * `deterministic`. Empty array ⇒ the polish preserves facts.
 *
 * Multi-word proper nouns are decomposed into individual capitalized
 * tokens by `extractFactTokens`, so a polish that introduces a new
 * proper noun anywhere will surface at least one new token here.
 */
export function factPreservationDiff(
  deterministic: string,
  polished: string,
): string[] {
  const allowed = extractFactTokens(deterministic);
  const found = extractFactTokens(polished);
  const introduced: string[] = [];
  for (const tok of found) {
    if (!allowed.has(tok)) introduced.push(tok);
  }
  return introduced;
}

// ============================================================
// Prompt
// ============================================================

function renderToneDescriptor(strategy: ToneStrategy): string {
  return [
    `register: ${strategy.openingVerbs.join("/")}-led`,
    `hedging: ${strategy.hedgeLevel}`,
    `voice: ${strategy.person} person`,
    `antithesis: ${strategy.antithesisTreatment}`,
    `conclusion: ${strategy.conclusionStrength}`,
  ].join("; ");
}

function buildPolishPrompt(input: PolishInput): string {
  const toneStrategy = resolveToneStrategy(input.tone as any);
  const standings = input.standingsSummary;
  const purposeLine = input.chainPurpose
    ? `Chain purpose (standings narrative — weave naturally into intro): ${input.chainPurpose}\n`
    : "";
  const refusalLine = standings.refusalBanner
    ? `\nIMPORTANT: preserve this refusal banner verbatim in the final paragraph:\n  "${standings.refusalBanner}"\n`
    : "";

  return `You are a copy editor improving the fluency of an academic essay generated by a deterministic argument-graph renderer. Your ONLY job is to make the prose read better. You must NOT:
  - introduce any fact, name, number, date, citation, or claim that does not already appear in the input;
  - change the logical relationships between claims;
  - remove or weaken any hedge (e.g. "plausibly", "on the available evidence", "though", "still-open question");
  - assert any conclusion that the input frames as a question or as blocked;
  - re-expand anaphoric noun phrases ("the same claim", "the same thesis", "the same validity claim", "this same position", "this same conclusion", "the same conclusion") back into the full conclusion text — these are intentional back-references and must be preserved as anaphors;
  - re-expand sentence-level anaphors ("This paragraph returns to the same thesis by an independent route.", "The argument here restates the same conclusion already defended above, approached from a different angle.", "Here, the case for the same claim is reinforced through a distinct line of reasoning.", "This paragraph recovers the same conclusion via a separate evidentiary path.") into the full conclusion sentence;
  - introduce a new verbatim copy of the defended thesis where the input used an anaphor or a compact reference — if the input refers back to a previously-stated claim by a short phrase, keep that short phrase;
  - echo the same em-dash continuation / curator-supplied edge description ("B conceded fully.", "B's cross-national divergence: …", etc.) more than once across the essay — if the same description appears twice in the input, drop the second occurrence.

Tone target: ${input.tone} (${renderToneDescriptor(toneStrategy)})
Audience: ${input.audience}
Standings: ${standings.survivingCount} surviving / ${standings.fallenCount} fallen / ${standings.residualCount} residual. ${standings.oneLiner}
${purposeLine}${refusalLine}
INPUT ESSAY (treat as authoritative for all facts):
"""
${input.deterministicProse}
"""

Return the polished essay only — no preface, no explanation, no markdown code fences. Preserve paragraph breaks.`;
}

// ============================================================
// Cache
// ============================================================

const POLISH_CACHE_PREFIX = "chain:polish:v1";
const POLISH_CACHE_TTL_SECONDS = 300; // matches synthetic-readout L1 TTL

function cacheKey(input: PolishInput): string {
  const model = input.modelId ?? "gpt-4o-mini";
  return [
    POLISH_CACHE_PREFIX,
    input.chainId,
    input.contentHash,
    input.tone,
    input.audience,
    model,
  ].join(":");
}

async function readCache(key: string): Promise<string | null> {
  const redis = tryGetUpstashRedis();
  if (!redis) return null;
  try {
    const v = await redis.get<string>(key);
    return typeof v === "string" && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, value: string): Promise<void> {
  const redis = tryGetUpstashRedis();
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: POLISH_CACHE_TTL_SECONDS });
  } catch {
    /* swallow — cache writes are best-effort */
  }
}

// ============================================================
// LLM call
// ============================================================

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  _openai = new OpenAI({ apiKey });
  return _openai;
}

async function callLLM(
  prompt: string,
  modelId: string,
): Promise<string | null> {
  const openai = getOpenAI();
  if (!openai) return null;
  try {
    const completion = await openai.chat.completions.create({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });
    const text = completion.choices[0]?.message?.content ?? "";
    return text.trim() || null;
  } catch (err) {
    console.error("[essayPolish] LLM call failed", err);
    return null;
  }
}

// ============================================================
// Main entry
// ============================================================

/**
 * Polish a deterministically-generated essay. Returns the polished text
 * on success, or the original deterministic text if the flag is off, the
 * LLM call fails, or the fact-preservation guard trips.
 *
 * Callers should treat the result as authoritative — they do not need to
 * inspect `usedPolish` for correctness; that field is provided only for
 * observability / UI affordances ("show original").
 */
export async function polishEssay(input: PolishInput): Promise<PolishResult> {
  if (!input.force && !isChainEssayPolishEnabled({ deliberationId: input.deliberationId })) {
    return {
      polished: input.deterministicProse,
      usedPolish: false,
      reason: "flag_off",
    };
  }

  const key = cacheKey(input);
  const cached = await readCache(key);
  if (cached) {
    return { polished: cached, usedPolish: true, reason: "cache_hit" };
  }

  const modelId = input.modelId ?? "gpt-4o-mini";
  const openai = getOpenAI();
  if (!openai) {
    return {
      polished: input.deterministicProse,
      usedPolish: false,
      reason: "missing_credentials",
    };
  }

  const prompt = buildPolishPrompt(input);
  const polished = await callLLM(prompt, modelId);
  if (!polished) {
    return {
      polished: input.deterministicProse,
      usedPolish: false,
      reason: "empty_response",
    };
  }

  const introduced = factPreservationDiff(input.deterministicProse, polished);
  if (introduced.length > 0) {
    console.warn(
      "[essayPolish] fact-guard tripped",
      JSON.stringify({
        chainId: input.chainId,
        contentHash: input.contentHash,
        introducedTokens: introduced.slice(0, 20),
      }),
    );
    return {
      polished: input.deterministicProse,
      usedPolish: false,
      reason: "fact_guard_tripped",
      introducedTokens: introduced,
    };
  }

  await writeCache(key, polished);
  return { polished, usedPolish: true };
}

// ============================================================
// Test-only helpers (exported for the unit suite)
// ============================================================

export const __TEST_ONLY__ = {
  buildPolishPrompt,
  cacheKey,
};
