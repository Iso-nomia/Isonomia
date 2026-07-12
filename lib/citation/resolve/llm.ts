/**
 * LLM fallback adapter for the Auto-Citation Engine.
 *
 * Phase 6 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * When Crossref + arXiv + Highwire all return nothing, we make ONE
 * gpt-4o-mini call (the project's existing LLM rail; Anthropic Haiku is
 * not currently wired) to ask: "given this HTML, return a CSL-JSON-ish
 * bibliographic record, or null."
 *
 * The result is *always* tagged `confidence: "low"` and the calling
 * waterfall surfaces it that way to the chip — the user is expected to
 * confirm or edit the metadata before relying on it.
 *
 * Hard guardrails:
 *   - Refuse to call the LLM without an OPENAI_API_KEY.
 *   - Refuse to send more than 12k chars of HTML (≈3k tokens of input).
 *   - Refuse to accept any field not on the strict allowlist.
 *   - Validate every returned field with Zod before constructing the
 *     ResolvedSource.
 *   - Hard-cap output tokens.
 */

import OpenAI from "openai";
import { z } from "zod";
import { SourceIdentifierType } from "@prisma/client";
import { acquireHostToken } from "./rateLimit";
import type { ResolvedSource } from "@/lib/integrations/crossref";

// ── Strict schema: anything not listed is dropped ─────────
const LlmCitationSchema = z.object({
  title: z.string().min(2).max(500).nullable().optional(),
  authors: z
    .array(z.object({ family: z.string().max(120).nullable().optional(), given: z.string().max(120).nullable().optional() }))
    .max(50)
    .optional(),
  year: z.number().int().min(1500).max(2100).nullable().optional(),
  container: z.string().max(300).nullable().optional(),
  publisher: z.string().max(300).nullable().optional(),
  doi: z
    .string()
    .regex(/^10\.\d{4,9}\/\S+$/i)
    .nullable()
    .optional(),
  abstract: z.string().max(4000).nullable().optional(),
});

const SYSTEM_PROMPT = `You extract bibliographic metadata from a single web page.
Return STRICT JSON matching this TypeScript shape, or {"title":null} if the page has no usable bibliographic info:

{
  "title": string | null,
  "authors": Array<{ "family": string | null, "given": string | null }>,
  "year": number | null,
  "container": string | null,   // journal, magazine, blog, site name
  "publisher": string | null,
  "doi": string | null,
  "abstract": string | null
}

Rules:
- Never invent. If a field is not unambiguously present, return null for that field.
- "year" must be the publication year, not the access year or copyright footer.
- "doi" must be a real DOI from the page (10.xxxx/...) — never construct one.
- Strip site names from titles ("Foo Article - Example Blog" → "Foo Article").
- Output JSON only. No markdown, no commentary.`;

interface LlmResolveOpts {
  /** Truncated HTML of the page. */
  html: string;
  /** The canonical URL (for the model's context only — we never bill it as auth). */
  url: string;
  /** Per-call timeout, default 8s. */
  timeoutMs?: number;
}

export async function resolveByLlm(
  opts: LlmResolveOpts,
): Promise<{ source: ResolvedSource; confidence: "low" } | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  // Outbound rate-limit bucket for OpenAI. Same shared limiter as
  // Crossref/OpenAlex — we don't want a thundering herd here either.
  const ok = await acquireHostToken("api.openai.com");
  if (!ok) return null;

  const html = opts.html.slice(0, 12_000);
  const userMessage = `URL: ${opts.url}\n\nHTML (truncated):\n${html}`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  let raw: string;
  try {
    const res = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 800,
      },
      { signal: controller.signal },
    );
    raw = res.choices[0]?.message?.content ?? "";
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (!raw) return null;

  let parsed: z.infer<typeof LlmCitationSchema>;
  try {
    parsed = LlmCitationSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }

  const title = parsed.title?.trim();
  if (!title) return null;

  const authors = (parsed.authors ?? [])
    .map((a) => ({
      family: a.family?.trim() || undefined,
      given: a.given?.trim() || undefined,
    }))
    .filter((a) => a.family || a.given);

  const doi = parsed.doi?.trim();

  const source: ResolvedSource = {
    identifier: doi || opts.url,
    identifierType: doi ? SourceIdentifierType.DOI : SourceIdentifierType.URL,
    title,
    authorsJson: authors,
    authorOrcids: [],
    year: parsed.year ?? undefined,
    abstractText: parsed.abstract?.trim() || undefined,
    container: parsed.container?.trim() || undefined,
    publisher: parsed.publisher?.trim() || undefined,
    keywords: [],
    url: opts.url,
    kind: "web",
  };
  return { source, confidence: "low" };
}
