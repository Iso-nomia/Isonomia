/**
 * Premise extraction (AI-EPI Phase 2.2).
 *
 * Splits a free-text claim into atomic premises with provenance back
 * into the source string. This is the missing piece behind the
 * `large-real-db` premise-recall=0.00 problem in the Phase 1
 * regression: when an argument's premises are stored as one prose
 * blob, the briefing has nothing to point at, the topology can't
 * compute load-bearing premises, and the LLM has no way to surface
 * them. Atomization lets every later stage (topology, frontier,
 * briefing) operate on real handles.
 *
 * Two extractor implementations live alongside this interface:
 *   - `mockPremiseExtractor`: deterministic, rule-based. Used in
 *     tests and in CI gates to avoid network dependence.
 *   - `openaiPremiseExtractor`: LLM-backed. Used in the Phase 2.2
 *     baseline regression (`eval:phase2:premise:openai`).
 *
 * Both share the same `PremiseExtractor` contract so the harness
 * runner is extractor-agnostic.
 */

/**
 * A single atomized premise. The text is the canonical phrasing
 * (extractor may have lightly normalized whitespace / sentence
 * boundaries); the provenanceSpan is `[start, end)` indices into the
 * original `claimText` so the UI can highlight the source range and
 * downstream code can re-derive the raw substring if needed.
 *
 * `[0, 0]` is a sentinel for "no span available" — extractors that
 * cannot honestly map an atom back to a contiguous source range
 * (e.g. when the atom comes from collapsing a complex nominalization)
 * MUST emit `[0, 0]` rather than guessing.
 */
export interface PremiseAtom {
  /** Canonical text of the atom. Trimmed; no trailing punctuation. */
  text: string;
  /** Half-open `[start, end)` index range into the source `claimText`. */
  provenanceSpan: readonly [number, number];
  /** Optional argument-scheme key (e.g. "expert-opinion") if the extractor inferred one. */
  scheme?: string;
}

/**
 * Result of extracting premises from a single claim text.
 *
 * `scheme` at the top level captures a scheme inference for the whole
 * claim when the extractor sees a structural cue (e.g. "according to
 * Dr. X" → expert-opinion). Per-atom `scheme` is reserved for cases
 * where atoms belong to different schemes — currently unused but
 * spec'd for future multi-scheme extractions.
 */
export interface PremiseExtraction {
  premises: PremiseAtom[];
  scheme?: string;
}

/**
 * Optional context an extractor can use to disambiguate. Kept tiny
 * deliberately — anything richer should flow through a higher-level
 * orchestrator, not through this leaf API.
 */
export interface PremiseExtractionContext {
  /** Surrounding paragraph or thread excerpt, if available. */
  contextHint?: string;
  /** A hint about the rhetorical/argument scheme expected. */
  schemeHint?: string;
}

export interface PremiseExtractor {
  extract(
    claimText: string,
    ctx?: PremiseExtractionContext,
  ): Promise<PremiseExtraction>;
}

/**
 * Deterministic rule-based extractor. Splits on:
 *   - explicit list markers: " and ", " & ", "; ", "; and "
 *   - subordinators that introduce a distinct premise: " because ",
 *     " since ", " given that "
 *   - sentence terminators: ". ", "! ", "? " (when followed by capital)
 *
 * Conservative by design: when in doubt it returns the input as a
 * single atom. The goal is to give the harness a reliable lower
 * bound and a known-good baseline against which the LLM extractor's
 * lift can be measured.
 *
 * Pure function. Same input → same output, every run.
 */
export const mockPremiseExtractor: PremiseExtractor = {
  async extract(claimText) {
    const text = (claimText ?? "").trim();
    if (text.length === 0) return { premises: [] };

    // Find split points and their consumed-length so we can compute
    // provenance spans into the ORIGINAL claimText (not the trimmed
    // version). Offset to convert trimmed-indices → original-indices.
    const leadingTrim = claimText.indexOf(text);
    const offset = leadingTrim < 0 ? 0 : leadingTrim;

    type Split = { at: number; consumed: number };
    const splits: Split[] = [];

    // Word-boundary delimiters (lowercased match).
    const delimiters = [
      " and ",
      " & ",
      "; and ",
      "; ",
      " because ",
      " since ",
      " given that ",
    ];

    const lower = text.toLowerCase();
    for (const d of delimiters) {
      let i = 0;
      while (true) {
        const found = lower.indexOf(d, i);
        if (found < 0) break;
        splits.push({ at: found, consumed: d.length });
        i = found + d.length;
      }
    }

    // Sentence terminators followed by a space + capital letter.
    const sentenceRe = /([.!?])\s+(?=[A-Z])/g;
    let sm: RegExpExecArray | null;
    while ((sm = sentenceRe.exec(text))) {
      // Keep the terminating punctuation on the left atom; the split
      // begins at the space after it.
      const at = sm.index + 1;
      const consumed = sm[0].length - 1;
      splits.push({ at, consumed });
    }

    if (splits.length === 0) {
      return {
        premises: [
          {
            text: stripTrailingPunctuation(text),
            provenanceSpan: [offset, offset + text.length] as const,
          },
        ],
      };
    }

    splits.sort((a, b) => a.at - b.at);

    const atoms: PremiseAtom[] = [];
    let cursor = 0;
    for (const sp of splits) {
      if (sp.at <= cursor) continue; // overlapping match, skip
      const piece = text.slice(cursor, sp.at);
      const pieceTrimmed = piece.trim();
      if (pieceTrimmed.length > 0) {
        const startInPiece = piece.indexOf(pieceTrimmed);
        const start = offset + cursor + (startInPiece < 0 ? 0 : startInPiece);
        atoms.push({
          text: stripTrailingPunctuation(pieceTrimmed),
          provenanceSpan: [start, start + pieceTrimmed.length] as const,
        });
      }
      cursor = sp.at + sp.consumed;
    }
    // Tail.
    const tail = text.slice(cursor);
    const tailTrimmed = tail.trim();
    if (tailTrimmed.length > 0) {
      const startInTail = tail.indexOf(tailTrimmed);
      const start = offset + cursor + (startInTail < 0 ? 0 : startInTail);
      atoms.push({
        text: stripTrailingPunctuation(tailTrimmed),
        provenanceSpan: [start, start + tailTrimmed.length] as const,
      });
    }

    // Degenerate case: all splits produced empties → return whole.
    if (atoms.length === 0) {
      return {
        premises: [
          {
            text: stripTrailingPunctuation(text),
            provenanceSpan: [offset, offset + text.length] as const,
          },
        ],
      };
    }

    return { premises: atoms };
  },
};

function stripTrailingPunctuation(s: string): string {
  return s.replace(/[\s.,;:!?]+$/u, "");
}

/**
 * OpenAI-backed extractor. Lazily constructs an `OpenAI` client so
 * importing this module never triggers a network or key lookup.
 *
 * Returned atoms are validated: every `provenanceSpan` is clamped to
 * the input length and each atom text is trimmed. Atoms whose text
 * collapses to empty after trimming are dropped. If the LLM returns
 * no usable atoms, we fall back to the mock extractor — a faithful
 * lower bound is always preferred to silence.
 */
export function createOpenAIPremiseExtractor(opts?: {
  apiKey?: string;
  model?: string;
}): PremiseExtractor {
  const model = opts?.model ?? "gpt-4o-mini";
  let client: import("openai").OpenAI | null = null;
  async function getClient() {
    if (client) return client;
    const { default: OpenAI } = await import("openai");
    client = new OpenAI({
      apiKey: opts?.apiKey ?? process.env.OPENAI_API_KEY,
    });
    return client;
  }

  const SYSTEM_PROMPT = `You split a single free-text claim into atomic premises.

Rules:
 1. Each premise is a single declarative proposition the claim asserts. Do not paraphrase aggressively — preserve the speaker's wording where possible.
 2. If the claim is already a single atom, return it as one premise.
 3. Conjunctions ("X and Y"), enumerations, and "because/since" links typically yield separate atoms. The "because" clause is its own premise.
 4. For each atom, provide a "provenanceSpan" as [start, end) character indices into the ORIGINAL claimText. If you cannot honestly map an atom to a contiguous source span, use [0, 0].
 5. Do not invent premises that are not asserted by the claim.

Return ONLY a JSON object of the form:
{
  "premises": [
    { "text": string, "provenanceSpan": [number, number], "scheme": string? }
  ],
  "scheme": string?
}`;

  return {
    async extract(claimText, ctx) {
      const trimmed = (claimText ?? "").trim();
      if (trimmed.length === 0) return { premises: [] };
      const c = await getClient();
      const userContent = JSON.stringify({
        claimText,
        contextHint: ctx?.contextHint ?? null,
        schemeHint: ctx?.schemeHint ?? null,
      });
      let raw: string;
      try {
        const resp = await c.chat.completions.create({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
        });
        raw = resp.choices[0]?.message?.content ?? "";
      } catch {
        return mockPremiseExtractor.extract(claimText, ctx);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return mockPremiseExtractor.extract(claimText, ctx);
      }
      const result = sanitizeExtraction(parsed, claimText);
      if (result.premises.length === 0) {
        return mockPremiseExtractor.extract(claimText, ctx);
      }
      return result;
    },
  };
}

function sanitizeExtraction(parsed: unknown, claimText: string): PremiseExtraction {
  const len = claimText.length;
  const obj = parsed as { premises?: unknown; scheme?: unknown };
  const raw = Array.isArray(obj?.premises) ? obj.premises : [];
  const atoms: PremiseAtom[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const rec = r as {
      text?: unknown;
      provenanceSpan?: unknown;
      scheme?: unknown;
    };
    const text = typeof rec.text === "string" ? stripTrailingPunctuation(rec.text.trim()) : "";
    if (!text) continue;
    let span: readonly [number, number] = [0, 0];
    if (
      Array.isArray(rec.provenanceSpan) &&
      rec.provenanceSpan.length === 2 &&
      typeof rec.provenanceSpan[0] === "number" &&
      typeof rec.provenanceSpan[1] === "number"
    ) {
      const a = Math.max(0, Math.min(len, Math.floor(rec.provenanceSpan[0] as number)));
      const b = Math.max(a, Math.min(len, Math.floor(rec.provenanceSpan[1] as number)));
      span = [a, b];
    }
    const scheme = typeof rec.scheme === "string" ? rec.scheme : undefined;
    atoms.push(scheme ? { text, provenanceSpan: span, scheme } : { text, provenanceSpan: span });
  }
  const out: PremiseExtraction = { premises: atoms };
  if (typeof obj?.scheme === "string") out.scheme = obj.scheme;
  return out;
}
