/**
 * Typology — Value lexicon seeder
 *
 * Heuristic: when a claim/argument body matches a configured value-laden
 * keyword (e.g. "equity", "freedom", "fairness", "tradition"), suggest a
 * VALUE-axis tag.
 *
 * The lexicon ships as a small in-repo list for B1; B2 swaps in a
 * configurable per-deliberation lexicon. LLM-driven suggestions remain
 * deferred (decision #6).
 */

import {
  DisagreementAxisKey,
  DisagreementTagSeedSource,
  DisagreementTagTargetType,
} from "../types";
import type { SeederDescriptor, SeederOutput } from "./types";

/** Lowercase keyword → short rationale snippet. */
const DEFAULT_LEXICON: Record<string, string> = {
  equity: "equity",
  fairness: "fairness",
  liberty: "liberty",
  freedom: "freedom",
  security: "security",
  tradition: "tradition",
  community: "community",
  efficiency: "efficiency",
  dignity: "dignity",
  justice: "justice",
  responsibility: "responsibility",
  solidarity: "solidarity",
};

export const valueLexiconSeeder: SeederDescriptor & {
  kind: "lexicon";
  scan: (input: LexiconScanInput) => SeederOutput | null;
  lexicon: typeof DEFAULT_LEXICON;
} = {
  name: "valueLexiconSeeder",
  version: 1,
  defaultEnabled: true,
  flag: "ff_typology_seeder_value_lexicon",
  kind: "lexicon",
  lexicon: DEFAULT_LEXICON,
  scan(input: LexiconScanInput): SeederOutput | null {
    if (!input.text || !input.text.trim()) return null;
    const lower = input.text.toLowerCase();
    const hits: string[] = [];
    for (const keyword of Object.keys(this.lexicon)) {
      // word-boundary match
      const re = new RegExp(`\\b${escapeRegex(keyword)}\\b`);
      if (re.test(lower)) hits.push(keyword);
    }
    if (hits.length === 0) return null;

    return {
      targetType: input.targetType,
      targetId: input.targetId,
      suggestedAxisKey: DisagreementAxisKey.VALUE,
      rationaleText: `Value-laden language detected: ${hits.join(", ")}.`,
      priority: 2,
      seedSource: DisagreementTagSeedSource.VALUE_LEXICON_SEED,
      seedReferenceJson: {
        // Lexicon scans are deterministic over (targetType, targetId, lexiconVersion);
        // include a lexiconScanId to make replays idempotent at the candidate layer.
        lexiconScanId: `${input.targetType}:${input.targetId}:${input.lexiconVersion ?? 1}`,
        keywords: hits,
        lexiconVersion: input.lexiconVersion ?? 1,
      },
    };
  },
};

export interface LexiconScanInput {
  targetType: DisagreementTagTargetType;
  targetId: string;
  text: string;
  lexiconVersion?: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
