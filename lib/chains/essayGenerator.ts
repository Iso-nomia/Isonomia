/**
 * Argument Chain Essay Generator
 * 
 * Transforms structured argument chains into seamless, flowing essay prose
 * that weaves together argumentation theory, scheme structures, and natural language.
 * 
 * Based on research from:
 * - Macagno, Walton & Reed: "Argumentation Schemes: History, Classifications, and Computational Applications"
 * - Wei & Prakken: "Defining the structure of arguments with AI models of argumentation"
 * - Walton's formal scheme structures with critical questions
 * 
 * Key Design Principles:
 * 1. Arguments are presented as natural reasoning, not enumerated items
 * 2. Scheme structures are woven into prose as explanatory context
 * 3. Dialectical relationships (support/attack) create narrative tension
 * 4. Critical questions surface as implicit challenges the essay addresses
 * 5. Formal elements (premises, warrants) appear as embedded explanations
 */

import { ArgumentChainWithRelations, ArgumentChainNodeWithArgument, ArgumentChainEdgeWithNodes } from "@/lib/types/argumentChain";

// ===== Types =====

export interface EssayOptions {
  /** Essay tone/register */
  tone?: "academic" | "journalistic" | "deliberative" | "persuasive";
  /** Target audience sophistication */
  audienceLevel?: "general" | "informed" | "expert";
  /** Include explicit scheme references */
  includeSchemeReferences?: boolean;
  /** Include critical questions as rhetorical elements */
  includeCriticalQuestions?: boolean;
  /** Weave in premise structure */
  includePremiseStructure?: boolean;
  /** Include dialectical analysis (attacks/rebuttals) */
  includeDialectic?: boolean;
  /** Maximum essay length (approximate word count) */
  maxLength?: number;
  /** Include chain type description in opening (Phase 4) */
  describeChainStructure?: boolean;
  /** Apply epistemic status language (Phase 4) */
  includeEpistemicLanguage?: boolean;
  /** Structure essay sections around scopes (Phase C) */
  structureByScopes?: boolean;
  /** Handle nested scopes as subsections (Phase C) */
  handleNestedScopes?: boolean;
  /**
   * M2a: honour per-node `epistemicStatus` (QUESTIONED/SUSPENDED/DENIED/
   * HYPOTHETICAL) at paragraph composition time. Defaults to `true`; set
   * to `false` only for diagnostic renders that want raw conclusions.
   */
  respectEpistemicStatus?: boolean;
  /**
   * M2b: dispatch paragraphs through role-keyed openers
   * (ANTITHESIS / SYNTHESIS / RESPONSE / CONCESSION). Defaults to `true`.
   */
  respectDialecticalRole?: boolean;
  /**
   * M2c: edges weaker than this threshold are dropped from inline
   * transitions so the prose doesn't promote marginal attacks. Default 0.3.
   */
  edgeStrengthThreshold?: number;
  /**
   * M3: refusal-surface honesty. When the deliberation's synthetic readout
   * lists `cannotConcludeBecause` entries whose target is a claim that
   * appears in this chain, the caller passes the blocked claim ids here.
   * The generator then:
   *   - never produces an assertive `<blocked-claim>.` sentence anywhere
   *     (opening preview / flow / conclusion all switch to question form);
   *   - appends a one-line refusal banner to the conclusion naming the
   *     weakest link, if supplied.
   * `blockedClaimIds` are `argument.conclusion.id` values (not node ids).
   */
  refusalSurface?: {
    blockedClaimIds: string[];
    weakestLinkLabel?: string;
    reasons?: string[];
  };
}

export interface EssayResult {
  title: string;
  abstract: string;
  body: string;
  fullText: string;
  wordCount: number;
  metadata: {
    chainId: string;
    argumentCount: number;
    schemeCount: number;
    dialecticalMoves: number;
    generatedAt: string;
  };
}

// ===== Rich Scheme Metadata Interface =====

interface SchemeMetadata {
  key: string;
  name: string | null;
  description: string | null;
  summary: string | null;
  // Formal structure
  premises: PremiseTemplate[] | null;
  conclusion: ConclusionTemplate | null;
  // Walton taxonomy
  purpose: string | null;
  source: string | null;
  materialRelation: string | null;
  reasoningType: string | null;
  ruleForm: string | null;
  conclusionType: string | null;
  // Critical questions
  cq: CriticalQuestionData[];
  // Guidance
  whenToUse: string | null;
  examples: string[];
  // Hierarchy
  clusterTag: string | null;
  parentSchemeId: string | null;
}

interface PremiseTemplate {
  id?: string;
  type?: "major" | "minor";
  text: string;
  variables?: string[];
}

interface ConclusionTemplate {
  text: string;
  variables?: string[];
}

interface CriticalQuestionData {
  key?: string;
  text: string;
  attackType?: string;
  targetScope?: string;
}

// ===== Text Processing Utilities =====

/**
 * Intelligently lowercase text while preserving proper nouns and acronyms
 * Handles common patterns in argumentative text (AI, EU, GDPR, etc.)
 *
 * Heuristic for proper-noun detection (M1 item 2):
 * The hardcoded `properNounPrefixes` list only catches names we anticipated.
 * Real chains cite arbitrary authors (Boxell, Gentzkow, Iyengar, Druckman…)
 * which were being mangled to `"boxell, Gentzkow…"`. We now treat the first
 * whitespace-delimited token as a proper noun whenever it is Title-Case
 * (initial caps + lowercase tail) AND not in a small stoplist of common
 * English sentence-starters that legitimately need lowercasing when spliced
 * into a larger sentence ("This", "The", "We", etc.).
 */
function smartLowercase(text: string): string {
  if (!text) return "";

  // Common acronyms to preserve (all caps)
  const acronyms = ['AI', 'EU', 'US', 'UK', 'UN', 'GDPR', 'NATO', 'UNESCO', 'WHO', 'WTO', 'FDA', 'FTC', 'OECD'];

  // Common proper nouns that might start sentences (names, organizations)
  const properNounPrefixes = [
    'Geoffrey', 'Yoshua', 'Stuart', 'Hinton', 'Bengio', 'Russell',
    'Congress', 'Parliament', 'Court', 'Senate', 'Commission',
    'NeurIPS', 'OpenAI', 'Google', 'Microsoft', 'DeepMind', 'Anthropic'
  ];

  // Sentence-starter pronouns / articles / connectives that SHOULD be
  // lowercased when the sentence is spliced into a longer one. Anything
  // else that looks Title-Case is treated as a proper noun.
  const sentenceStarters = new Set([
    'A', 'An', 'The', 'This', 'That', 'These', 'Those',
    'It', 'Its', 'They', 'Their', 'There',
    'We', 'Our', 'Us', 'You', 'Your', 'I', 'My', 'Me',
    'He', 'She', 'His', 'Her', 'Him',
    'When', 'While', 'If', 'Although', 'Because', 'Since',
    'Whether', 'Either', 'Neither', 'Unless', 'Until',
    'Such', 'Some', 'Many', 'Most', 'Any', 'Both', 'Each', 'Every',
    'Here', 'Now', 'Then', 'Thus', 'Hence', 'Therefore', 'However',
    'Moreover', 'Furthermore', 'Indeed', 'Yet', 'But', 'And', 'Or',
    'For', 'In', 'On', 'At', 'By', 'With', 'From', 'To', 'Of', 'As',
    'One', 'Two', 'Three', 'Four', 'Five', 'First', 'Second', 'Third',
  ]);

  // Check if text starts with a proper noun - don't lowercase
  for (const noun of properNounPrefixes) {
    if (text.startsWith(noun)) {
      return text;
    }
  }

  // Check if text starts with an acronym - don't lowercase
  for (const acronym of acronyms) {
    if (text.startsWith(acronym + ' ') || text === acronym) {
      return text;
    }
  }

  // Generic proper-noun heuristic: first token Title-Case (e.g. "Boxell"),
  // contains at least one lowercase letter (rules out single-letter "A"),
  // and is not a known sentence-starter -> treat as proper noun.
  const firstToken = text.split(/[\s,;:.()\[\]]/, 1)[0] ?? "";
  if (
    firstToken.length >= 2 &&
    /^[A-Z][a-z]/.test(firstToken) &&
    !sentenceStarters.has(firstToken)
  ) {
    return text;
  }

  // All-caps tokens of length >=2 (generic acronym catch) also pass through.
  if (firstToken.length >= 2 && /^[A-Z]+$/.test(firstToken)) {
    return text;
  }

  // Single-letter capital used as a possessive label ("A's argument",
  // "B's critique") — common in dialectical writing. Preserve the capital.
  if (/^[A-Z]['']s\b/.test(text)) {
    return text;
  }

  // Lowercase the first character only (preserve rest)
  let result = text.charAt(0).toLowerCase() + text.slice(1);
  
  // Restore acronyms that may have been lowercased (mid-sentence)
  acronyms.forEach(acronym => {
    const regex = new RegExp(`\\b${acronym.toLowerCase()}\\b`, 'g');
    result = result.replace(regex, acronym);
  });
  
  return result;
}

/**
 * Ensure text ends with proper punctuation
 */
function ensurePeriod(text: string): string {
  const trimmed = text.trim();
  if (/[.!?]$/.test(trimmed)) return trimmed;
  return trimmed + ".";
}

/**
 * Lowercase the first letter of `text` for mid-sentence splicing while
 * preserving the standard set of acronyms (AI / EU / US / UK / UN / RCT /
 * GDPR / NATO / FDA / …). Used by the warrant-rendering site, which used
 * to call raw `.toLowerCase()` and produce mangled output ("us-specific
 * structural vulnerabilities", "rcts", "if us political structure …").
 */
function preserveAcronymLowercase(text: string): string {
  if (!text) return "";
  const acronyms = [
    "AI", "EU", "US", "UK", "UN", "GDPR", "NATO", "UNESCO", "WHO", "WTO",
    "FDA", "FTC", "OECD", "RCT", "RCTs", "MSI", "ANES", "OLS",
  ];
  let out = text.charAt(0).toLowerCase() + text.slice(1);
  out = out.toLowerCase();
  for (const a of acronyms) {
    // Restore the acronym wherever its lowercased form appears as a whole
    // word. Hyphenated tails like "us-specific" → "US-specific" are also
    // recovered because `\b` matches the hyphen boundary.
    const re = new RegExp(`\\b${a.toLowerCase()}\\b`, "g");
    out = out.replace(re, a);
  }
  return out;
}

/**
 * Spell out small cardinal integers (1–10) as words. Larger numbers fall
 * back to their digit form. Used to avoid sentence-initial digit forms
 * such as "4 points of significant disagreement…".
 */
function spellOut(n: number): string {
  const words = [
    "zero", "one", "two", "three", "four", "five",
    "six", "seven", "eight", "nine", "ten",
  ];
  if (!Number.isFinite(n) || n < 0) return String(n);
  if (n <= 10) return words[n];
  return String(n);
}

// ===== M3.8 G: boilerplate / thesis-anaphora dedupe helpers =====
//
// Several render templates fire once per body paragraph and produce
// near-identical sentences across a 6-node chain ("The definitional
// basis of this argument makes the classification straightforward.",
// "The underlying warrant—the principle that licenses this inference—
// holds that …", "Two questions remain open for the critical reader:",
// "The reasoning rests on multiple considerations.", etc.). The first
// occurrence frames the discourse for the reader; subsequent
// occurrences read as filler. `takeBoilerplateKey` returns `true` the
// first time a given key is requested per essay and `false` thereafter,
// so callers can choose between a full and a short / skipped form.
//
// `_renderedBoilerplateKeys`, `_renderedConclusionKeys`, and
// `_thesisAnaphorCursor` are private fields on `innerOptions` (see
// `generateEssay`) so the dedupe state is per-essay, not global.
function takeBoilerplateKey(key: string, options: EssayOptions): boolean {
  const set = (options as any)._renderedBoilerplateKeys;
  if (!(set instanceof Set)) return true;
  if (set.has(key)) return false;
  set.add(key);
  return true;
}

// Sentence-level anaphors used when a paragraph would otherwise re-emit
// the full thesis text verbatim. Cycled deterministically so essay
// output stays seed-stable.
const THESIS_ANAPHOR_SENTENCES = [
  "The argument here restates the same conclusion already defended above, approached from a different angle.",
  "This paragraph returns to the same thesis by an independent route.",
  "Here the case for the same claim is reinforced through a distinct line of reasoning.",
  "The line of reasoning below recovers the same conclusion from new supporting material.",
];

// Noun-phrase anaphors for mid-sentence interpolation in logical-flow
// edges and dialectical splices. Used when the conclusion text has
// already been rendered somewhere upstream in the essay; emitting the
// full thesis a fourth or fifth time inside a connective phrase reads
// as drone repetition.
const THESIS_NP_ANAPHORS = [
  "the same validity claim",
  "the same thesis",
  "this same position",
  "the same conclusion",
  "this claim",
];

function normalizeConclusionKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s.,;:?!"'\u2018\u2019\u201C\u201D]+/g, " ")
    .trim();
}

/**
 * Detect whether `conclusionText` has already been rendered as a body
 * paragraph's opening claim. Returns either the original text (first
 * occurrence — caller renders normally) or `{ anaphor: <sentence> }`
 * (subsequent occurrence — caller skips the reasoning-opener template
 * and pushes the anaphor instead, then continues with premises/warrant
 * /CQs which still carry fresh content).
 */
function checkConclusionAnaphor(
  conclusionText: string,
  options: EssayOptions,
): { anaphor: string } | null {
  const set = (options as any)._renderedConclusionKeys;
  if (!(set instanceof Set)) return null;
  const key = normalizeConclusionKey(conclusionText);
  if (!key) return null;
  if (!set.has(key)) {
    set.add(key);
    return null;
  }
  const cursor = (options as any)._thesisSentenceAnaphorCursor as
    | { i: number }
    | undefined;
  const idx = cursor ? cursor.i++ : 0;
  return {
    anaphor: THESIS_ANAPHOR_SENTENCES[idx % THESIS_ANAPHOR_SENTENCES.length],
  };
}

// Noun-phrase variant of `checkConclusionAnaphor`. Shares the same
// `_renderedConclusionKeys` set: whichever site fires first claims the
// verbatim render and subsequent sites — whether sentence-level
// (paragraph openers) or noun-phrase (logical-flow / dialectical edges)
// — receive an anaphor. Returns the original text on first sight (and
// mutates the set), or a short noun phrase on subsequent calls.
function npAnaphor(text: string, options: EssayOptions): string {
  if (!text) return text;
  const set = (options as any)._renderedConclusionKeys;
  if (!(set instanceof Set)) return text;
  const key = normalizeConclusionKey(text);
  if (!key) return text;
  if (!set.has(key)) {
    set.add(key);
    return text;
  }
  const cursor = (options as any)._thesisAnaphorCursor as
    | { i: number }
    | undefined;
  const idx = cursor ? cursor.i++ : 0;
  return THESIS_NP_ANAPHORS[idx % THESIS_NP_ANAPHORS.length];
}

// Track attack-description sentences that have already been rendered
// as an em-dash continuation (in `generateDialecticalExchange`, in
// support-edge descriptions, and in the J fallen-objections render).
// Returns the text on first sight; returns `""` on repeat so callers
// can drop the continuation entirely.
function dedupeAttackDescription(
  desc: string | null | undefined,
  options: EssayOptions,
): string {
  if (!desc) return "";
  const set = (options as any)._renderedAttackDescriptions;
  if (!(set instanceof Set)) return desc;
  const key = normalizeConclusionKey(desc);
  if (!key) return desc;
  if (set.has(key)) return "";
  set.add(key);
  return desc;
}

/**
 * Detect critical-question text whose scheme placeholders were never
 * instantiated. Walton-style CQs use single-capital letters as variables
 * ("Does study S actually have defect D…", "Is the literature really agreed
 * that defects of kind K bias inferences in direction B…"). When two or
 * more such bare capitals appear in a single question, the template has not
 * been bound to the chain's actual content and the question should not be
 * surfaced verbatim to the reader.
 *
 * Single-capital pronouns / articles ("A", "I") are excluded so chains that
 * legitimately reference "Argument A" or "Position B" still pass through.
 */
function cqHasUnfilledPlaceholders(text: string): boolean {
  if (!text) return false;
  const matches = text.match(/\b[A-Z]\b/g) ?? [];
  const placeholders = matches.filter((m) => m !== "A" && m !== "I");
  return placeholders.length >= 2;
}

/**
 * Compose a grammatically appropriate opening sentence from a chain purpose
 * string and a chain type (M1 item 1).
 *
 * The previous splice was a single fixed template — "The question before us
 * concerns <purpose>." — which produced awkward constructions whenever the
 * purpose started with an interrogative ("Whether X is Y") or a bare verb
 * ("Examine the validity of X"). This helper branches on the surface form
 * of the purpose so that:
 *  - "Whether ..."           → "The question before us is whether ..."
 *  - "How/Why/What/When ..."  → "We turn to the question of <lowercased> ..."
 *  - Verb-initial purpose     → "This chain sets out to <lowercased>."
 *  - Noun-phrase purpose      → "This essay examines <lowercased>."
 *
 * Chain type colors the framing for DIVERGENT / TREE / GRAPH chains where the
 * "question" framing reads better than the "thesis" framing.
 */
export function composeIntroLead(
  purpose: string,
  chainType: string,
  prep: (s: string) => string = (s) => s
): string {
  const raw = purpose.trim().replace(/[.!?]+$/, "");
  if (!raw) return "";

  const firstWord = raw.split(/\s+/, 1)[0] ?? "";

  // Interrogative lead-ins: "Whether ...", "How ...", "Why ...", "What ..."
  if (/^whether$/i.test(firstWord)) {
    return `The question before us is ${prep(raw)}.`;
  }
  if (/^(how|why|what|when|where|which|who)$/i.test(firstWord)) {
    return `We turn to the question of ${prep(raw)}.`;
  }

  // Bare-verb leads ("Examine", "Determine", "Evaluate", "Assess", "Consider",
  // "Decide", "Capture", …). A small allow-list keeps us from misclassifying
  // noun phrases that happen to start with a Title-Case verb form like
  // "Trust". The list is extended generously because new chains regularly
  // surface fresh imperatives; if a new verb-lead slips through, the
  // suffix-based detector below catches the common `-e`/`-ish` shapes.
  const verbLeads = new Set([
    "Examine", "Determine", "Evaluate", "Assess", "Consider",
    "Decide", "Investigate", "Analyze", "Test", "Establish",
    "Resolve", "Adjudicate", "Defend", "Argue",
    "Capture", "Map", "Identify", "Trace", "Survey", "Audit",
    "Characterize", "Compare", "Contrast", "Quantify", "Bound",
    "Reconcile", "Reassess", "Refute", "Validate", "Verify",
    "Clarify", "Distinguish", "Demonstrate", "Show", "Prove",
    "Disprove", "Explain", "Account", "Specify", "Articulate",
  ]);
  // Heuristic fall-back: a Title-Case first word followed by an article
  // ("the/a/an") or a bare noun phrase (no internal capitals) is almost
  // certainly an imperative verb. The article test catches the
  // "Capture the aggregation gap" / "Map the contested band" shape.
  const secondWord = raw.split(/\s+/, 2)[1] ?? "";
  const looksImperative =
    /^[A-Z][a-z]+$/.test(firstWord) && /^(the|a|an|whether|how|why)$/i.test(secondWord);
  if (verbLeads.has(firstWord) || looksImperative) {
    // M3.6 A: `prep` (smartLowercase) treats any Title-Case first token
    // not in `sentenceStarters` as a proper noun and returns it unchanged,
    // which leaves verb-leads like "Capture" capitalized ("… sets out to
    // Capture the aggregation gap"). Force the first letter down here.
    const lowered = raw.charAt(0).toLowerCase() + raw.slice(1);
    return `This chain sets out to ${lowered}.`;
  }

  // Noun-phrase fall-through. Vary the framing slightly for divergent /
  // graph-shaped chains, which read better as "examines" than as a single
  // question.
  const examinChains = new Set(["DIVERGENT", "TREE", "GRAPH"]);
  if (examinChains.has(chainType)) {
    return `This essay examines ${prep(raw)}.`;
  }
  return `The question before us concerns ${prep(raw)}.`;
}

// ===== Natural Language Weaving Utilities =====

/**
 * Maps reasoning types to natural discourse markers
 */
const REASONING_DISCOURSE_MARKERS: Record<string, string[]> = {
  deductive: [
    "It follows necessarily that",
    "This leads us to conclude",
    "From these premises, we can derive",
    "The logical consequence is",
  ],
  inductive: [
    "The evidence suggests",
    "Based on these observations",
    "The pattern indicates",
    "Drawing from experience",
  ],
  abductive: [
    "The best explanation for this",
    "What would account for this",
    "The most plausible interpretation",
    "This can be understood as",
  ],
  practical: [
    "Given our objectives",
    "To achieve this goal",
    "The appropriate course of action",
    "Prudence dictates that",
  ],
};

/**
 * Maps material relations to bridging phrases
 */
const MATERIAL_RELATION_BRIDGES: Record<string, string[]> = {
  cause: [
    "because",
    "as a result of",
    "owing to the fact that",
    "given that",
  ],
  definition: [
    "by definition",
    "what it means to be",
    "in virtue of being",
    "precisely because it is",
  ],
  analogy: [
    "just as",
    "in the same way that",
    "drawing a parallel with",
    "much like",
  ],
  authority: [
    "according to",
    "as established by",
    "on the authority of",
    "expert consensus holds that",
  ],
  sign: [
    "as evidenced by",
    "the indicators suggest",
    "observable signs point to",
    "this is symptomatic of",
  ],
  example: [
    "as demonstrated in the case of",
    "the precedent of",
    "exemplified by",
    "as we see in",
  ],
};

/**
 * Maps edge types to transitional phrases that create narrative flow
 */
const EDGE_NARRATIVE_TRANSITIONS: Record<string, string[]> = {
  SUPPORTS: [
    "This reasoning is strengthened by",
    "Further support comes from",
    "Reinforcing this point,",
    "Building on this foundation,",
  ],
  REFUTES: [
    "However, this faces a significant challenge:",
    "A compelling counterargument holds that",
    "Yet this reasoning is contested by",
    "Against this view stands the objection that",
  ],
  // M2c: the canonical ArgumentChainEdgeType enum uses REBUTS / UNDERCUTS /
  // UNDERMINES alongside REFUTES; each gets its own discourse register so
  // that an undercut ("even granting the premise") doesn't read identically
  // to a flat refutation.
  REBUTS: [
    "By contrast, the opposing view counters that",
    "However, this is rebutted by the claim that",
    "By contrast, the rebuttal holds that",
    "However, a direct rebuttal counters that",
  ],
  UNDERCUTS: [
    "Even granting the premise, this inference is undercut by",
    "This warrant is undercut by",
    "Yet the inferential step is undermined, because",
    "The link itself is challenged: ",
  ],
  UNDERMINES: [
    "This footing is undermined by",
    "The supporting ground is undermined by",
    "However, the supporting evidence is undermined by",
    "The premise itself is undermined by",
  ],
  ENABLES: [
    "This opens the path to",
    "Having established this, we can now consider",
    "This makes possible the further argument that",
    "With this foundation in place",
  ],
  PRESUPPOSES: [
    "This argument depends on the prior recognition that",
    "Underlying this reasoning is the premise that",
    "The force of this argument rests on",
    "Before proceeding, we must acknowledge that",
  ],
  QUALIFIES: [
    "Though with an important qualification:",
    "This holds true, but with conditions:",
    "The argument applies, subject to the caveat that",
    "While generally valid, this must be tempered by",
  ],
  EXEMPLIFIES: [
    "A concrete illustration of this principle",
    "This is demonstrated in practice by",
    "To see this in action, consider",
    "The abstract principle takes concrete form in",
  ],
  GENERALIZES: [
    "From this specific case, we can extract a broader principle:",
    "Generalizing from this instance",
    "This points to the wider truth that",
    "The particular reveals the general:",
  ],
};

// ===== Chain Type Essay Descriptions (Phase 4) =====

const CHAIN_TYPE_ESSAY_DESCRIPTIONS: Record<string, {
  opening: string;
  structure: string;
  flowDescription: string;
}> = {
  SERIAL: {
    opening: "This essay traces a sequence of interconnected arguments",
    structure: "each building upon its predecessor in a logical chain",
    flowDescription: "The reasoning unfolds step by step, with each argument laying the groundwork for the next."
  },
  CONVERGENT: {
    opening: "This essay presents multiple independent arguments that converge upon a central thesis",
    structure: "offering complementary perspectives that reinforce one another",
    flowDescription: "Several distinct lines of reasoning come together to establish a shared conclusion."
  },
  DIVERGENT: {
    opening: "Beginning from a foundational premise, this essay explores multiple implications",
    structure: "drawing several distinct conclusions from common ground",
    flowDescription: "A single well-established claim gives rise to a range of consequences and applications."
  },
  TREE: {
    opening: "This essay is structured hierarchically",
    structure: "moving from broad principles to specific applications",
    flowDescription: "The argumentation branches at key points, addressing distinct aspects at each level."
  },
  GRAPH: {
    opening: "The argumentative landscape forms a complex network of interrelated claims",
    structure: "which this essay navigates systematically",
    flowDescription: "Arguments relate to one another in multiple ways, creating a rich deliberative fabric."
  }
};

// ===== Epistemic Status Essay Language (Phase 4) =====

const EPISTEMIC_ESSAY_LANGUAGE: Record<string, {
  introPhrase: string;
  contextMarker: string;
  closingNote: string;
}> = {
  ASSERTED: {
    introPhrase: "",
    contextMarker: "",
    closingNote: ""
  },
  HYPOTHETICAL: {
    introPhrase: "Let us suppose, for the sake of argument, that ",
    contextMarker: "Under this hypothesis, ",
    closingNote: "This hypothetical exploration illuminates possibilities worth considering."
  },
  COUNTERFACTUAL: {
    introPhrase: "Consider a counterfactual scenario in which ",
    contextMarker: "In this contrary-to-fact scenario, ",
    closingNote: "Though contrary to actual events, this counterfactual analysis reveals important insights."
  },
  CONDITIONAL: {
    introPhrase: "If we accept that ",
    contextMarker: "Given this condition, ",
    closingNote: "The conditional nature of this reasoning should be kept in mind."
  },
  QUESTIONED: {
    introPhrase: "It remains an open question whether ",
    // M2a: hedged premise transitions for QUESTIONED nodes. "Plausibly, on
    // the available evidence" gives the reader an explicit cue that the
    // surrounding sentences are tentative and licenses the downstream
    // synthesis conclusion to remain qualified.
    contextMarker: "Plausibly, on the available evidence, ",
    closingNote: "This matter awaits conclusive resolution."
  },
  DENIED: {
    introPhrase: "While some have argued that ",
    contextMarker: "Despite the rejection of this view, ",
    closingNote: "Though this position has been denied, understanding it illuminates the debate."
  },
  SUSPENDED: {
    introPhrase: "Setting aside for now the question of whether ",
    contextMarker: "Bracketing this consideration, ",
    closingNote: "This suspended judgment may be revisited as the analysis develops."
  }
};

/**
 * Get epistemic intro phrase for essay
 */
function getEssayEpistemicIntro(status: string | null | undefined): string {
  if (!status || status === "ASSERTED") return "";
  return EPISTEMIC_ESSAY_LANGUAGE[status]?.introPhrase || "";
}

/**
 * Get epistemic context marker for essay transitions
 */
function getEssayEpistemicContext(status: string | null | undefined): string {
  if (!status || status === "ASSERTED") return "";
  return EPISTEMIC_ESSAY_LANGUAGE[status]?.contextMarker || "";
}

// ===== Scope Essay Section Templates (Phase C) =====

const SCOPE_ESSAY_TEMPLATES: Record<string, {
  sectionTitle: string;
  opening: string;
  transition: string;
  closing: string;
}> = {
  HYPOTHETICAL: {
    sectionTitle: "Hypothetical Analysis",
    opening: "Let us consider a hypothetical scenario",
    transition: "Under this assumption, a distinct line of reasoning emerges",
    closing: "This hypothetical exploration, while not conclusive, illuminates possibilities that merit consideration in our overall assessment."
  },
  COUNTERFACTUAL: {
    sectionTitle: "Counterfactual Exploration",
    opening: "Consider, contrary to the actual facts, a scenario in which",
    transition: "In this alternative reality, the argumentative landscape shifts",
    closing: "Though this scenario did not come to pass, understanding its implications deepens our grasp of the underlying causal and logical structures."
  },
  CONDITIONAL: {
    sectionTitle: "Conditional Reasoning",
    opening: "If we accept the following condition",
    transition: "Given this conditional framework, certain conclusions follow",
    closing: "The conditional nature of this analysis should guide how we apply these conclusions to cases where the condition obtains."
  },
  OPPONENT: {
    sectionTitle: "Considering the Opposition",
    opening: "From a contrasting perspective, some maintain that",
    transition: "This opposing viewpoint advances arguments that",
    closing: "Engaging seriously with this opposition strengthens our overall understanding and highlights where the strongest points of contention lie."
  },
  MODAL: {
    sectionTitle: "Modal Analysis",
    opening: "In a possible world where",
    transition: "The logical consequences in this modal context reveal",
    closing: "This modal exploration extends our analysis beyond the actual to consider what is possible, necessary, or contingent."
  }
};

/**
 * Interface for scope with nodes for essay generation
 */
interface EssayScopeData {
  id: string;
  scopeType: string;
  assumption: string;
  color?: string | null;
  parentId?: string | null;
  nodes: ArgumentChainNodeWithArgument[];
  childScopes?: EssayScopeData[];
  depth: number;
}

/**
 * Group nodes by scope and build hierarchy for essay structure
 */
function groupNodesForEssay(
  nodes: ArgumentChainNodeWithArgument[],
  scopes: any[] | undefined
): { mainNodes: ArgumentChainNodeWithArgument[]; scopeSections: EssayScopeData[] } {
  const mainNodes: ArgumentChainNodeWithArgument[] = [];
  const scopeMap = new Map<string, EssayScopeData>();

  // Initialize scope groups
  if (scopes) {
    for (const scope of scopes) {
      scopeMap.set(scope.id, {
        id: scope.id,
        scopeType: scope.scopeType,
        assumption: scope.assumption,
        color: scope.color,
        parentId: scope.parentId,
        nodes: [],
        childScopes: [],
        depth: 0
      });
    }
  }

  // Assign nodes to scopes or main list
  for (const node of nodes) {
    const scopeId = (node as any).scopeId;
    if (scopeId && scopeMap.has(scopeId)) {
      scopeMap.get(scopeId)!.nodes.push(node);
    } else {
      mainNodes.push(node);
    }
  }

  // Build scope hierarchy and calculate depths
  const rootScopes: EssayScopeData[] = [];
  
  const calculateDepth = (scope: EssayScopeData, depth: number) => {
    scope.depth = depth;
    scope.childScopes?.forEach(child => calculateDepth(child, depth + 1));
  };

  for (const scope of scopeMap.values()) {
    if (scope.parentId && scopeMap.has(scope.parentId)) {
      scopeMap.get(scope.parentId)!.childScopes?.push(scope);
    } else {
      rootScopes.push(scope);
    }
  }

  // Calculate depths starting from roots
  rootScopes.forEach(scope => calculateDepth(scope, 0));

  return { mainNodes, scopeSections: rootScopes };
}

/**
 * Generate essay section for a scope (with recursive handling for nested scopes)
 */
function generateScopeEssaySection(
  scope: EssayScopeData,
  options: EssayOptions,
  nodeIndex: { current: number }
): string {
  const template = SCOPE_ESSAY_TEMPLATES[scope.scopeType] || SCOPE_ESSAY_TEMPLATES.HYPOTHETICAL;
  const headingLevel = Math.min(scope.depth + 2, 4); // h2, h3, h4 max
  const heading = "#".repeat(headingLevel);
  
  const parts: string[] = [];
  
  // Section header
  parts.push(`${heading} ${template.sectionTitle}: *${scope.assumption}*\n`);
  
  // Opening paragraph
  parts.push(`${template.opening}: *"${scope.assumption}"*. ${template.transition}.\n`);
  
  // Generate prose for nodes in this scope
  if (scope.nodes.length > 0) {
    scope.nodes.forEach(node => {
      const scheme = extractSchemeMetadata(node);
      const premises = getArgumentPremises(node);
      const warrant = getImplicitWarrant(node);
      const nodeProse = generateArgumentProseForEssay(node, scheme, premises, warrant, options);
      parts.push(nodeProse);
      nodeIndex.current++;
    });
  }
  
  // Recursively handle nested scopes
  if (scope.childScopes && scope.childScopes.length > 0) {
    scope.childScopes.forEach(childScope => {
      parts.push("\n" + generateScopeEssaySection(childScope, options, nodeIndex));
    });
  }
  
  // Closing paragraph
  parts.push(`\n${template.closing}\n`);
  
  return parts.join("\n");
}

/**
 * Generate argument prose specifically for essay context (simplified wrapper)
 */
function generateArgumentProseForEssay(
  node: ArgumentChainNodeWithArgument,
  scheme: SchemeMetadata | null,
  premises: Array<{ text: string; isImplicit: boolean }>,
  warrant: string | null,
  options: EssayOptions
): string {
  // Delegate to the existing generateArgumentProse function
  return generateArgumentProse(node, scheme, premises, warrant, options);
}

/**
 * Generate overview paragraph introducing the scoped sections
 */
function generateScopeOverview(scopes: EssayScopeData[]): string {
  if (scopes.length === 0) return "";
  
  const scopeDescriptions: string[] = [];
  
  scopes.forEach(scope => {
    const template = SCOPE_ESSAY_TEMPLATES[scope.scopeType] || SCOPE_ESSAY_TEMPLATES.HYPOTHETICAL;
    const nodeCount = countNodesInScope(scope);
    scopeDescriptions.push(
      `a ${template.sectionTitle.toLowerCase()} (${nodeCount} argument${nodeCount !== 1 ? "s" : ""}) examining the assumption that *"${scope.assumption}"*`
    );
  });
  
  if (scopes.length === 1) {
    return `Beyond the main line of argument, this essay also includes ${scopeDescriptions[0]}. This scoped analysis allows us to explore reasoning under specific conditions or perspectives.`;
  }
  
  const lastScope = scopeDescriptions.pop();
  return `Beyond the main line of argument, this essay includes ${scopeDescriptions.join(", ")}, and ${lastScope}. These scoped sections allow us to explore reasoning under various conditions and perspectives, enriching the overall analysis.`;
}

/**
 * Count total nodes in a scope including nested scopes
 */
function countNodesInScope(scope: EssayScopeData): number {
  let count = scope.nodes.length;
  if (scope.childScopes) {
    scope.childScopes.forEach(child => {
      count += countNodesInScope(child);
    });
  }
  return count;
}

/**
 * Generate conclusion paragraph summarizing scoped analyses
 */
function generateScopeConclusion(scopes: EssayScopeData[]): string {
  if (scopes.length === 0) return "";
  
  const summaries: string[] = [];
  
  scopes.forEach(scope => {
    const template = SCOPE_ESSAY_TEMPLATES[scope.scopeType] || SCOPE_ESSAY_TEMPLATES.HYPOTHETICAL;
    summaries.push(`The ${template.sectionTitle.toLowerCase()} of *"${scope.assumption}"*`);
  });
  
  if (scopes.length === 1) {
    return `${summaries[0]} has provided additional depth to our understanding, illuminating aspects of the argument that might otherwise remain implicit or unexplored.`;
  }
  
  const lastSummary = summaries.pop();
  return `The various scoped analyses—${summaries.join(", ")}, and ${lastSummary}—have each contributed unique perspectives that enrich our understanding of the central thesis and its implications.`;
}

/**
 * Select a random element from array for variety
 */
function sample<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===== Data Extraction Utilities =====

/**
 * Extract scheme metadata from a node
 */
function extractSchemeMetadata(node: ArgumentChainNodeWithArgument): SchemeMetadata | null {
  const arg = node.argument as any;
  if (!arg) return null;

  // Check argumentSchemes relation (Phase 4 multi-scheme)
  if (arg.argumentSchemes && arg.argumentSchemes.length > 0) {
    const schemeInstance = arg.argumentSchemes[0];
    const scheme = schemeInstance.scheme;
    return parseSchemeToMetadata(scheme);
  }

  // Check schemeNet for complex sequential reasoning
  if (arg.schemeNet?.steps && arg.schemeNet.steps.length > 0) {
    const firstStep = arg.schemeNet.steps[0];
    return parseSchemeToMetadata(firstStep.scheme);
  }

  return null;
}

/**
 * Parse raw scheme data into structured metadata
 */
function parseSchemeToMetadata(scheme: any): SchemeMetadata {
  return {
    key: scheme.key || "",
    name: scheme.name || null,
    description: scheme.description || null,
    summary: scheme.summary || null,
    premises: parsePremises(scheme.premises),
    conclusion: parseConclusion(scheme.conclusion),
    purpose: scheme.purpose || null,
    source: scheme.source || null,
    materialRelation: scheme.materialRelation || null,
    reasoningType: scheme.reasoningType || null,
    ruleForm: scheme.ruleForm || null,
    conclusionType: scheme.conclusionType || null,
    cq: parseCriticalQuestions(scheme.cq || scheme.cqs),
    whenToUse: scheme.whenToUse || null,
    examples: scheme.examples || [],
    clusterTag: scheme.clusterTag || null,
    parentSchemeId: scheme.parentSchemeId || null,
  };
}

/**
 * Parse premises JSON into structured array
 */
function parsePremises(premises: any): PremiseTemplate[] | null {
  if (!premises) return null;
  
  if (Array.isArray(premises)) {
    return premises.map(p => ({
      id: p.id || undefined,
      type: p.type || p.premiseType || undefined,
      text: p.text || p.template || (typeof p === "string" ? p : ""),
      variables: p.variables || [],
    })).filter(p => p.text);
  }
  
  if (typeof premises === "object") {
    return Object.entries(premises).map(([key, value]: [string, any]) => ({
      id: key,
      type: value.type || value.premiseType || undefined,
      text: value.text || value.template || "",
      variables: value.variables || [],
    })).filter(p => p.text);
  }
  
  return null;
}

/**
 * Parse conclusion JSON
 */
function parseConclusion(conclusion: any): ConclusionTemplate | null {
  if (!conclusion) return null;
  
  if (typeof conclusion === "string") {
    return { text: conclusion, variables: [] };
  }
  
  return {
    text: conclusion.text || conclusion.template || "",
    variables: conclusion.variables || [],
  };
}

/**
 * Parse critical questions from various formats
 */
function parseCriticalQuestions(cq: any): CriticalQuestionData[] {
  if (!cq) return [];
  
  if (Array.isArray(cq)) {
    return cq.map(q => {
      if (typeof q === "string") return { text: q };
      return {
        key: q.key || q.id || undefined,
        text: q.text || q.question || q.questionText || "",
        attackType: q.attackType || undefined,
        targetScope: q.targetScope || q.target || undefined,
      };
    }).filter(q => q.text);
  }
  
  if (typeof cq === "object") {
    return Object.entries(cq).map(([key, value]: [string, any]) => ({
      key,
      text: typeof value === "string" ? value : value.text || value.question || "",
      attackType: typeof value === "object" ? value.attackType : undefined,
      targetScope: typeof value === "object" ? value.targetScope : undefined,
    })).filter(q => q.text);
  }
  
  return [];
}

/**
 * Get argument premises (actual claim data)
 */
function getArgumentPremises(node: ArgumentChainNodeWithArgument): Array<{ text: string; isImplicit: boolean }> {
  const arg = node.argument as any;
  if (!arg?.premises || !Array.isArray(arg.premises)) return [];
  
  return arg.premises.map((p: any) => ({
    text: p.claim?.text || "",
    isImplicit: p.isImplicit || false,
  })).filter((p: any) => p.text);
}

/**
 * Get implicit warrant if present
 */
function getImplicitWarrant(node: ArgumentChainNodeWithArgument): string | null {
  const arg = node.argument as any;
  if (!arg?.implicitWarrant) return null;
  
  if (typeof arg.implicitWarrant === "string") return arg.implicitWarrant;
  if (typeof arg.implicitWarrant === "object") {
    return arg.implicitWarrant.text || arg.implicitWarrant.warrant || null;
  }
  return null;
}

/**
 * Get argument conclusion text
 */
function getArgumentConclusion(node: ArgumentChainNodeWithArgument): string {
  const arg = node.argument as any;
  if (arg?.conclusion?.text) return arg.conclusion.text;
  if (arg?.text) return arg.text;
  return "No conclusion available";
}

// ===== Essay Structure Analysis =====

/**
 * Analyze chain structure to determine narrative arc
 */
interface NarrativeStructure {
  openingArguments: ArgumentChainNodeWithArgument[];
  developingArguments: ArgumentChainNodeWithArgument[];
  contestedArguments: ArgumentChainNodeWithArgument[];
  resolutionArguments: ArgumentChainNodeWithArgument[];
  mainThesis: ArgumentChainNodeWithArgument | null;
  dialecticalPairs: Array<{
    thesis: ArgumentChainNodeWithArgument;
    antithesis: ArgumentChainNodeWithArgument;
    synthesis: ArgumentChainNodeWithArgument | null;
  }>;
}

function analyzeNarrativeStructure(
  nodes: ArgumentChainNodeWithArgument[],
  edges: ArgumentChainEdgeWithNodes[]
): NarrativeStructure {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Calculate in-degree and out-degree for each node
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const attackedBy = new Map<string, string[]>();
  const attacks = new Map<string, string[]>();
  
  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    outDegree.set(n.id, 0);
    attackedBy.set(n.id, []);
    attacks.set(n.id, []);
  });
  
  edges.forEach(e => {
    outDegree.set(e.sourceNodeId, (outDegree.get(e.sourceNodeId) || 0) + 1);
    inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) || 0) + 1);
    
    // Track attack relationships
    if (
      e.edgeType === "REFUTES" ||
      e.edgeType === "REBUTS" ||
      e.edgeType === "UNDERCUTS" ||
      e.edgeType === "UNDERMINES"
    ) {
      attackedBy.get(e.targetNodeId)?.push(e.sourceNodeId);
      attacks.get(e.sourceNodeId)?.push(e.targetNodeId);
    }
  });
  
  // Opening arguments: roots (no incoming edges)
  const openingArguments = nodes.filter(n => inDegree.get(n.id) === 0);
  
  // Resolution arguments: leaves with no outgoing edges (typically conclusions)
  const resolutionArguments = nodes.filter(n => outDegree.get(n.id) === 0);
  
  // Contested arguments: those that have attacks
  const contestedArguments = nodes.filter(n => (attackedBy.get(n.id)?.length || 0) > 0);
  
  // Developing arguments: middle nodes
  const openAndResolutionIds = new Set([
    ...openingArguments.map(n => n.id),
    ...resolutionArguments.map(n => n.id)
  ]);
  const developingArguments = nodes.filter(n => !openAndResolutionIds.has(n.id));
  
  // Main thesis: the node with most incoming support edges (most supported conclusion)
  let mainThesis: ArgumentChainNodeWithArgument | null = null;
  let maxSupport = 0;
  nodes.forEach(n => {
    const supportCount = edges.filter(
      e => e.targetNodeId === n.id && e.edgeType === "SUPPORTS"
    ).length;
    if (supportCount > maxSupport) {
      maxSupport = supportCount;
      mainThesis = n;
    }
  });
  
  // Find dialectical pairs (thesis-antithesis-synthesis patterns).
  // M1 item 3: prefer attackers whose `dialecticalRole === "ANTITHESIS"` so
  // the antithesis paragraph always names B's own conclusion (not the
  // thesis claim). Edge-based discovery remains the fallback for chains
  // that don't tag dialectical roles.
  const dialecticalPairs: NarrativeStructure["dialecticalPairs"] = [];
  contestedArguments.forEach(thesis => {
    const attackerIds = attackedBy.get(thesis.id) || [];
    const attackerNodes = attackerIds
      .map(id => nodeMap.get(id))
      .filter((n): n is ArgumentChainNodeWithArgument => !!n);

    const roleTagged = attackerNodes.filter(
      n => (n as any).dialecticalRole === "ANTITHESIS"
    );
    const orderedAttackers = roleTagged.length > 0 ? roleTagged : attackerNodes;

    orderedAttackers.forEach(antithesis => {
      // Look for a synthesis: something that supports both or follows from the exchange
      const synthesisCandidates = edges
        .filter(e =>
          (e.sourceNodeId === thesis.id || e.sourceNodeId === antithesis.id) &&
          e.edgeType === "SUPPORTS"
        )
        .map(e => nodeMap.get(e.targetNodeId))
        .filter(Boolean);

      // Prefer a SYNTHESIS-roled candidate when available.
      const syntheses = synthesisCandidates as ArgumentChainNodeWithArgument[];
      const synthesisRoleTagged = syntheses.find(
        s => (s as any).dialecticalRole === "SYNTHESIS"
      );

      dialecticalPairs.push({
        thesis,
        antithesis,
        synthesis: synthesisRoleTagged || syntheses[0] || null,
      });
    });
  });
  
  return {
    openingArguments,
    developingArguments,
    contestedArguments,
    resolutionArguments,
    mainThesis,
    dialecticalPairs,
  };
}

// ===== Prose Generation Functions =====

/**
 * Generate an opening paragraph that sets up the deliberation
 */
function generateOpening(
  chain: ArgumentChainWithRelations,
  structure: NarrativeStructure,
  options: EssayOptions
): string {
  const paragraphs: string[] = [];
  const { describeChainStructure = true } = options;
  
  // Phase 4: Get chain type for structural description
  const chainType = (chain as any).chainType || "GRAPH";
  const typeInfo = CHAIN_TYPE_ESSAY_DESCRIPTIONS[chainType] || CHAIN_TYPE_ESSAY_DESCRIPTIONS.GRAPH;
  
  // Helper to clean text for introduction
  const cleanPurpose = (text: string): string => {
    let cleaned = text.trim();
    // Remove trailing punctuation since we add our own
    cleaned = cleaned.replace(/[.!?]+$/, "");
    // Use smartLowercase to preserve proper nouns/acronyms
    return smartLowercase(cleaned);
  };

  // Thematic opening based on chain purpose
  if (chain.purpose) {
    const lead = composeIntroLead(chain.purpose, chainType, cleanPurpose);
    let openingParagraph = lead;

    // Phase 4: Add chain type description
    if (describeChainStructure) {
      openingParagraph += ` ${typeInfo.opening}, ${typeInfo.structure}.`;
    } else {
      openingParagraph += ` This analysis examines the arguments and considerations that bear on this matter.`;
    }

    paragraphs.push(openingParagraph);
  } else if (chain.description) {
    let descParagraph = chain.description;
    
    // Phase 4: Append chain type description if not already descriptive
    if (describeChainStructure && descParagraph.length < 200) {
      descParagraph += ` ${typeInfo.flowDescription}`;
    }
    
    paragraphs.push(descParagraph);
  } else {
    // Default opening with chain type (Phase 4)
    if (describeChainStructure) {
      paragraphs.push(
        `${typeInfo.opening}, ${typeInfo.structure}. ${typeInfo.flowDescription}`
      );
    } else {
      paragraphs.push(
        `This essay presents a structured analysis of interconnected arguments, ` +
        `tracing the logical relationships that bind them together.`
      );
    }
  }
  
  // Preview the argumentative landscape
  // Preview the argumentative landscape
  if (structure.openingArguments.length > 0) {
    // M2a: only quote ASSERTED claims here — QUESTIONED / SUSPENDED /
    // DENIED conclusions previewed verbatim would read as endorsements
    // of contested propositions in the opening paragraph.
    const assertedOpening = structure.openingArguments.filter(n => {
      const s = (n as any).epistemicStatus;
      return !s || s === "ASSERTED";
    });
    const previewSource = assertedOpening.length > 0 ? assertedOpening : structure.openingArguments;
    const previewCount = previewSource.length;
    const previewLimit = 3;
    const openingClaims = previewSource
      .slice(0, previewLimit)
      .map(n => getArgumentConclusion(n))
      .map(c => `"${c.length > 80 ? c.slice(0, 80) + "..." : c}"`);

    // M3.5 #3: spell out small counts and, when the chain is too large to
    // preview every consideration, signal that only the first three are
    // surfaced rather than leaving readers to wonder why "19 foundational
    // considerations" is followed by a three-item list.
    if (previewCount > previewLimit) {
      paragraphs.push(
        `The analysis begins from ${spellOut(previewCount)} foundational considerations; ` +
        `${spellOut(previewLimit)} are central: ` +
        openingClaims.join("; and ") + "."
      );
    } else {
      paragraphs.push(
        `The analysis begins from ${spellOut(previewCount)} foundational consideration${previewCount > 1 ? "s" : ""}: ` +
        openingClaims.join("; and ") + "."
      );
    }
  }

  // Signal dialectical complexity if present
  if (structure.dialecticalPairs.length > 0) {
    const count = structure.dialecticalPairs.length;
    paragraphs.push(
      `The reasoning is not uncontested. ${spellOut(count)[0].toUpperCase()}${spellOut(count).slice(1)} point${count > 1 ? "s" : ""} of significant disagreement ` +
      `reveal the tensions inherent in this domain, requiring careful navigation between competing considerations.`
    );
  }
  
  return paragraphs.join("\n\n");
}

/**
 * Generate prose for a single argument, weaving in scheme structure
 */
function generateArgumentProse(
  node: ArgumentChainNodeWithArgument,
  scheme: SchemeMetadata | null,
  premises: Array<{ text: string; isImplicit: boolean }>,
  warrant: string | null,
  options: EssayOptions
): string {
  const rawConclusion = getArgumentConclusion(node);
  const parts: string[] = [];
  const { includeEpistemicLanguage = true } = options;

  // M3: when this node's claim sits in the deliberation's refusal surface
  // we must never render it as a closed assertion. Strip the trailing
  // period and override the closer to `?` so every downstream splice in
  // this function ("It follows that X.", "The evidence points to X.",
  // etc.) emits "...X?" instead. Premise bridges further down still run
  // unchanged — they explain *why the question is open*, not why the
  // claim is true.
  const blockedNodeIds =
    ((options as any)._blockedNodeIds as Set<string> | undefined) ?? new Set();
  const isBlocked = blockedNodeIds.has(node.id);

  // Phase 4: Get epistemic status
  const epistemicStatus = (node as any).epistemicStatus as string | null;
  const epistemicIntro = includeEpistemicLanguage ? getEssayEpistemicIntro(epistemicStatus) : "";

  // M3.6 F: only append `?` when the conclusion is going to be spliced
  // as a bare assertion ("It follows that <X>."). When an epistemicIntro
  // is present ("While some have argued that <X>", "It remains an open
  // question whether <X>", "Let us suppose, for the sake of argument,
  // that <X>"), the outer frame is already non-assertoric, so we use a
  // period — "<X>? Despite the rejection of this view, …" reads as if
  // the previous sentence asked a question, but the frame ("While some
  // have argued that …") is actually a concession to a claim. Keep the
  // `?` for unframed reasoning-type splices, since those would otherwise
  // render blocked claims as closed assertions.
  const stripped = rawConclusion.replace(/\.$/, "");
  const conclusion = !isBlocked
    ? rawConclusion
    : epistemicIntro
      ? stripped + "."
      : stripped + "?";

  // M3.8 G: thesis-anaphora. Chains commonly contain multiple nodes whose
  // conclusion text is the chain's defended thesis. Emitting the full
  // thesis sentence at the start of every such paragraph drowns the
  // reader in repetition. On the second+ render of the same conclusion
  // we emit a short anaphoric sentence and skip the reasoning-type
  // opener (premises / warrant / CQs still run, since they carry fresh
  // material for that paragraph). Blocked paragraphs are left alone so
  // the refusal-aware framing still surfaces the contested claim text.
  const anaphor = isBlocked ? null : checkConclusionAnaphor(stripped, options);
  if (anaphor) {
    parts.push(anaphor.anaphor);
  } else if (epistemicIntro) {
    // M3.8 H: `epistemicIntro` ("While some have argued that ", "It
    // remains an open question whether ", "Plausibly, on the available
    // evidence, ", "Setting aside for now the question of whether ") is
    // already a complete propositional wrapper. Compounding it with a
    // reasoning-type opener ("the evidence points to an important
    // conclusion:", "the most plausible explanation is that", …)
    // produces stacked nonsense: "While some have argued that the
    // evidence points to an important conclusion: <thesis>". The
    // reasoning type is already carried by the warrant / premise frame
    // downstream — the reader doesn't need both layers. Emit the
    // conclusion bare under the epistemic wrapper.
    parts.push(`${epistemicIntro}${smartLowercase(conclusion)}`);
  } else if (scheme?.reasoningType) {
    const reasoningType = scheme.reasoningType.toLowerCase();
    
    // Create natural sentence openings based on reasoning type
    if (reasoningType === "inductive") {
      parts.push(`The evidence points to an important conclusion: ${conclusion}`);
    } else if (reasoningType === "abductive") {
      parts.push(`The most plausible explanation is that ${smartLowercase(conclusion)}`);
    } else if (reasoningType === "practical") {
      parts.push(`From a practical standpoint, ${smartLowercase(conclusion)}`);
    } else if (reasoningType === "deductive") {
      parts.push(`It follows that ${smartLowercase(conclusion)}`);
    } else {
      parts.push(conclusion);
    }
  } else {
    parts.push(conclusion);
  }
  
  // Weave in premises using material relation bridges
  // Phase 4: Use epistemic context marker for premise transitions
  const epistemicContext = includeEpistemicLanguage ? getEssayEpistemicContext(epistemicStatus) : "";
  
  if (premises.length > 0 && options.includePremiseStructure !== false) {
    // M3.5 #2: filter out premise statements that earlier paragraphs have
    // already surfaced verbatim. Sibling nodes in the same chain often
    // share an evidence pool (e.g. cited studies, statistics) and the
    // un-deduped paragraphs read as near-identical copies.
    const renderedPremiseTexts: Set<string> | null =
      (options as any)._renderedPremiseTexts instanceof Set
        ? ((options as any)._renderedPremiseTexts as Set<string>)
        : null;
    const premiseDedupeKey = (text: string) =>
      text.trim().toLowerCase().replace(/\s+/g, " ");
    const freshPremises = renderedPremiseTexts
      ? premises.filter((p) => !renderedPremiseTexts.has(premiseDedupeKey(p.text)))
      : premises.slice();

    // If everything has already been said, skip the evidence block entirely
    // rather than re-emitting it under a fresh discourse marker.
    if (freshPremises.length === 0) {
      // no-op: downstream sentences (scheme reference, warrant) still run.
    } else if (freshPremises.length === 1) {
      const bridge = scheme?.materialRelation 
        ? sample(MATERIAL_RELATION_BRIDGES[scheme.materialRelation.toLowerCase()] || ["This follows from the fact that"])
        : "This follows from the fact that";
      parts.push(`${epistemicContext}${epistemicContext ? bridge.toLowerCase() : bridge} ${smartLowercase(freshPremises[0].text)}`);
      if (renderedPremiseTexts) renderedPremiseTexts.add(premiseDedupeKey(freshPremises[0].text));
    } else {
      // Multiple premises - create sophisticated enumeration
      const premiseIntros = epistemicContext 
        ? [
            `${epistemicContext}this conclusion draws support from several observations.`,
            `${epistemicContext}the reasoning rests on multiple considerations.`,
            `${epistemicContext}several factors converge to support this view.`,
          ]
        : [
            "This conclusion draws support from several observations.",
            "The reasoning rests on multiple considerations.",
            "Several factors converge to support this view.",
          ];
      
      // M3.8 G: only emit the framing sentence the first time; downstream
      // paragraphs let the `First, … Additionally, … Finally, …`
      // discourse markers carry the enumeration on their own.
      if (takeBoilerplateKey("multi_premise_intro", options)) {
        parts.push(sample(premiseIntros));
      }
      
      // Present premises as a flowing paragraph rather than a list
      const premiseNarratives = freshPremises.map((p, i) => {
        const text = p.text;
        if (i === 0) return `First, ${smartLowercase(text)}`;
        if (i === freshPremises.length - 1) return `Finally, ${smartLowercase(text)}`;
        return `Additionally, ${smartLowercase(text)}`;
      });
      
      parts.push(premiseNarratives.join(" "));

      if (renderedPremiseTexts) {
        for (const p of freshPremises) renderedPremiseTexts.add(premiseDedupeKey(p.text));
      }
    }
  }
  
  // Add scheme context if requested - weave it naturally into the narrative
  if (scheme && options.includeSchemeReferences) {
    const schemeName = scheme.name || scheme.key.replace(/_/g, " ");
    
    // Create natural scheme references based on material relation
    if (scheme.materialRelation) {
      const relationContexts: Record<string, string> = {
        "cause": `This causal reasoning follows a well-established pattern of inference.`,
        "analogy": `The force of this analogical argument depends on the relevant similarities holding.`,
        "authority": `This appeal to expert authority carries weight insofar as the expertise is relevant and reliable.`,
        "sign": `Reading these signs requires careful attention to the reliability of the indicators.`,
        "definition": `The definitional basis of this argument makes the classification straightforward.`,
        "example": `The generalization from this example invites scrutiny of its representativeness.`,
      };
      
      if (relationContexts[scheme.materialRelation.toLowerCase()]) {
        // M3.8 G: scheme-context sentences are keyed per material relation
        // — the reader doesn't need the same "This causal reasoning follows
        // a well-established pattern of inference." gloss in every causal
        // paragraph. Emit once per relation, then skip on subsequent
        // paragraphs of the same scheme family.
        const relKey = `scheme_relation:${scheme.materialRelation.toLowerCase()}`;
        if (takeBoilerplateKey(relKey, options)) {
          parts.push(relationContexts[scheme.materialRelation.toLowerCase()]);
        }
      }
    } else if (scheme.description) {
      // M3.5 #4: scheme descriptions are sometimes raw Walton-style
      // templates with unbound placeholders ("An expert E in domain D
      // asserts that A; therefore A"). Skip those rather than emit them
      // as essay prose.
      if (!cqHasUnfilledPlaceholders(scheme.description)) {
        parts.push(scheme.description);
      }
    }
  }
  
  // Warrant as the inferential license - present naturally
  if (warrant && options.includePremiseStructure !== false) {
    // M3.6 C: raw `.toLowerCase()` destroys acronyms (US → us, RCT → rct).
    // Route through `smartLowercase` (which preserves the known-acronym
    // allowlist) and additionally restore mid-sentence US/UK/RCT/etc.
    // tokens so warrants like "interacts with US-specific structural
    // vulnerabilities" survive the splice.
    //
    // M3.8 G: first warrant gets the full em-dash gloss ("the principle
    // that licenses this inference"); subsequent warrants drop the gloss
    // and use a leaner connective — the reader has already been taught
    // what the warrant role is.
    const warrantBody = preserveAcronymLowercase(warrant).replace(/\.$/, "");
    if (takeBoilerplateKey("warrant_gloss", options)) {
      parts.push(`The underlying warrant—the principle that licenses this inference—holds that ${warrantBody}.`);
    } else {
      parts.push(`The warrant here holds that ${warrantBody}.`);
    }
  }
  
  // Critical questions as implicit challenges addressed (M1 item 4)
  // - Previously concatenated raw question text ("requires considering both is
  //   the source a genuine expert … and is the assertion …") which was
  //   ungrammatical. Now branches on audience: expert readers get a compact
  //   parenthetical that frames each CQ as an objection the author addresses;
  //   general/informed readers get the questions rendered as questions.
  // - `answeredCqKeys` (when provided by callers that have read `CqStatus`)
  //   filters out CQs that already have an answer on record so we don't
  //   surface them as still-open challenges.
  if (scheme && options.includeCriticalQuestions && scheme.cq.length > 0) {
    const answered = (options as any).answeredCqKeys instanceof Set
      ? ((options as any).answeredCqKeys as Set<string>)
      : null;
    const renderedCqKeys: Set<string> | null =
      (options as any)._renderedCqKeys instanceof Set
        ? ((options as any)._renderedCqKeys as Set<string>)
        : null;
    const cqDedupeKey = (cq: CriticalQuestionData) =>
      cq.key || cq.text.trim().toLowerCase();
    const openCQs = scheme.cq.filter((cq) => {
      // M3.5 #4: drop scheme CQs that still contain unbound placeholder
      // variables (e.g. "Does study S actually have defect D…").
      if (cqHasUnfilledPlaceholders(cq.text)) return false;
      if (answered && cq.key && answered.has(cq.key)) return false;
      // M3.5 #5: dedupe CQs across sibling-node paragraphs so the same
      // critical question is not surfaced multiple times in one essay.
      if (renderedCqKeys && renderedCqKeys.has(cqDedupeKey(cq))) return false;
      return true;
    });
    const relevantCQs = openCQs.slice(0, 2);

    if (relevantCQs.length > 0) {
      const cleaned = relevantCQs.map(cq => cq.text.replace(/\?$/, "").trim());

      if (options.audienceLevel === "expert") {
        // Frame as objections the author has addressed. Keep the CQs as
        // intact interrogatives — naive prefix-stripping produced
        // ungrammatical phrases ("whether the source a genuine expert"),
        // so we leave the question wording alone and quote it as a question
        // the author engages.
        const questions = cleaned.map(q => `${q}?`).join(" ");
        const label = relevantCQs.length === 1 ? "question" : "questions";
        parts.push(`The author addresses the following ${label}: ${questions}`);
      } else {
        // Keep questions as questions for non-expert readers.
        const questions = cleaned.map(q => `${q}?`).join(" ");
        // M3.8 G: first CQ block gets the full pedagogical framing;
        // subsequent blocks use a leaner "Further open questions" lead-in.
        const cqFirst = takeBoilerplateKey("cq_intro", options);
        if (relevantCQs.length === 1) {
          parts.push(
            cqFirst
              ? `A critical reader might ask: ${questions}`
              : `A further critical question: ${questions}`,
          );
        } else {
          parts.push(
            cqFirst
              ? `Two questions remain open for the critical reader: ${questions}`
              : `Further open questions: ${questions}`,
          );
        }
      }

      if (renderedCqKeys) {
        for (const cq of relevantCQs) renderedCqKeys.add(cqDedupeKey(cq));
      }
    }
  }
  
  return parts.join(" ");
}

/**
 * Generate dialectical exchange prose (thesis-antithesis-synthesis)
 * Presents opposing arguments in a natural thesis-antithesis-synthesis structure
 */
function generateDialecticalExchange(
  pair: NarrativeStructure["dialecticalPairs"][0],
  edges: ArgumentChainEdgeWithNodes[],
  options: EssayOptions
): string {
  const parts: string[] = [];
  
  const thesisConclusion = getArgumentConclusion(pair.thesis);
  const thesisScheme = extractSchemeMetadata(pair.thesis);
  
  const antithesisConclusion = getArgumentConclusion(pair.antithesis);
  const antithesisScheme = extractSchemeMetadata(pair.antithesis);
  
  // Find the edge connecting them
  const attackEdge = edges.find(
    e => e.sourceNodeId === pair.antithesis.id && e.targetNodeId === pair.thesis.id
  );
  
  // Varied thesis introductions
  const thesisIntros = [
    "One line of reasoning holds that",
    "According to one perspective,",
    "Proponents of this view argue that",
    "The initial position maintains that",
    "A central argument in this discourse is that",
  ];
  
  // Present the thesis with proper casing
  const thesisText = smartLowercase(thesisConclusion.replace(/\.$/, ""));
  
  // Build scheme context phrase if both elements are meaningful
  let thesisSchemeContext = "";
  if (thesisScheme && options.includeSchemeReferences) {
    const reasoningType = thesisScheme.reasoningType?.toLowerCase();
    const materialRelation = thesisScheme.materialRelation?.toLowerCase();
    
    // Only add scheme reference if we have meaningful distinct values
    if (reasoningType && materialRelation && reasoningType !== materialRelation) {
      thesisSchemeContext = ` This ${reasoningType} reasoning draws upon ${materialRelation}.`;
    } else if (reasoningType) {
      thesisSchemeContext = ` This ${reasoningType} reasoning lends weight to the conclusion.`;
    }
  }
  
  parts.push(`${sample(thesisIntros)} ${thesisText}.${thesisSchemeContext}`);
  
  // Add thesis premises if structured
  if (options.includePremiseStructure && thesisScheme?.premises?.length) {
    // M3.6 B: premises are `PremiseTemplate[]`; flattening them with
    // `.join` produces `[object Object], and [object Object]`. Extract
    // `.text` (or fall back to string coercion for legacy callers).
    const premiseText = thesisScheme.premises
      .slice(0, 2)
      .map((p) => (typeof p === "string" ? p : (p && (p as any).text) || ""))
      .filter(Boolean)
      .join(", and ");
    if (premiseText) {
      parts.push(`The reasoning proceeds from the understanding that ${smartLowercase(premiseText)}.`);
    }
  }
  
  // Transition to antithesis with narrative tension
  const attackTransition = attackEdge?.edgeType 
    ? sample(EDGE_NARRATIVE_TRANSITIONS[attackEdge.edgeType] || EDGE_NARRATIVE_TRANSITIONS["REFUTES"])
    : sample(EDGE_NARRATIVE_TRANSITIONS["REFUTES"]);
  
  // M3.8 anaphora: antithesis conclusion may be the same text as the
  // defended thesis (when a defensive node also launches an attack).
  // Anaphorize to avoid "a direct rebuttal counters that <thesis>…"
  // repeating the thesis verbatim.
  const antithesisText = smartLowercase(npAnaphor(antithesisConclusion.replace(/\.$/, ""), options));
  // M3.8 attack-desc dedupe: drop the em-dash continuation when this
  // exact description has already been rendered by another splice site.
  const dedupedAttackDesc = dedupeAttackDescription(attackEdge?.description, options);
  parts.push(
    `${attackTransition} ${antithesisText}.` +
    (dedupedAttackDesc ? ` ${dedupedAttackDesc}` : "")
  );
  
  // Add antithesis reasoning context (improved)
  if (antithesisScheme && options.includeSchemeReferences) {
    const antithesisReasoningType = antithesisScheme.reasoningType?.toLowerCase();
    if (antithesisReasoningType && antithesisReasoningType !== "practical") {
      parts.push(`This ${antithesisReasoningType} argument challenges the original position by introducing competing considerations.`);
    } else {
      parts.push(`This counter-argument challenges the original position by introducing competing considerations.`);
    }
  }
  
  // If there's a synthesis, present the resolution
  if (pair.synthesis) {
    const synthesisConclusion = getArgumentConclusion(pair.synthesis);
    const synthesisText = smartLowercase(synthesisConclusion.replace(/\.$/, ""));
    const resolutionPhrases = [
      `These competing considerations find resolution in the recognition that ${synthesisText}.`,
      `A synthesis emerges: ${synthesisText}.`,
      `Reconciling these perspectives leads to the understanding that ${synthesisText}.`,
      `The tension is resolved through the insight that ${synthesisText}.`,
    ];
    parts.push(sample(resolutionPhrases));
  } else {
    const unresolvedPhrases = [
      "This tension remains a point of ongoing deliberation, reflecting genuine complexity in the subject matter.",
      "The debate continues, with both perspectives offering valuable insights into this multifaceted issue.",
      "This dialectical opposition invites further examination and remains an open question in the discourse.",
    ];
    parts.push(sample(unresolvedPhrases));
  }
  
  return parts.join(" ");
}

/**
 * Generate the logical flow section connecting arguments
 * Creates prose that describes the structural relationships between arguments
 */
function generateLogicalFlow(
  nodes: ArgumentChainNodeWithArgument[],
  edges: ArgumentChainEdgeWithNodes[],
  options: EssayOptions
): string {
  const parts: string[] = [];

  // M3: refusal-surface awareness for the support/qualify summaries below.
  // When the support edge's *target* is a blocked claim, we must not say
  // the chain "provides grounding for X" (which restates X assertively).
  // Same idea for qualifies. Empty set is the no-op fast path.
  const blockedNodeIds =
    ((options as any)._blockedNodeIds as Set<string> | undefined) ?? new Set();

  // Build adjacency for narrative flow
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Process edges by type for thematic grouping
  const supportEdges = edges.filter(e => e.edgeType === "SUPPORTS");
  const enableEdges = edges.filter(e => e.edgeType === "ENABLES");
  const presupposesEdges = edges.filter(e => e.edgeType === "PRESUPPOSES");
  const qualifiesEdges = edges.filter(e => e.edgeType === "QUALIFIES");
  
  // Describe support relationships as building blocks (more natural prose)
  if (supportEdges.length > 0) {
    const supportDescriptions: string[] = [];
    
    supportEdges.forEach(edge => {
      const source = nodeMap.get(edge.sourceNodeId);
      const target = nodeMap.get(edge.targetNodeId);
      if (!source || !target) return;
      
      const rawSource = getArgumentConclusion(source).replace(/\.$/, "");
      const rawTarget = getArgumentConclusion(target).replace(/\.$/, "");

      // M3: when the target sits in the refusal surface, every support
      // sentence is reframed as supplying a strand *toward an open
      // question* — never as grounding a settled claim. We push and
      // return early so the strength/description appendix below (which
      // expects an assertive frame) doesn't run.
      if (blockedNodeIds.has(target.id)) {
        // M3.8 anaphora/collapse: if the source claim and the blocked
        // target are the same normalized text, we'd otherwise render
        // "The recognition that <thesis> supplies one strand toward the
        // still-open question of whether <thesis>…" — the thesis
        // appears twice in one sentence. Collapse to a short pointer
        // back to the residual band.
        const sourceKey = normalizeConclusionKey(rawSource);
        const targetKey = normalizeConclusionKey(rawTarget);
        if (sourceKey && sourceKey === targetKey) {
          // Touch the set so downstream renderers know this claim has
          // been surfaced; subsequent occurrences will anaphorize.
          npAnaphor(rawSource, options);
          supportDescriptions.push(
            `This same claim recurs as the chain's still-open contested band.`,
          );
          return;
        }
        const sourceForFlow = smartLowercase(npAnaphor(rawSource, options));
        const targetForFlow = smartLowercase(npAnaphor(rawTarget, options));
        supportDescriptions.push(
          `The recognition that ${sourceForFlow} supplies one strand toward the still-open question of whether ${targetForFlow}, though the chain's conclusion remains blocked.`,
        );
        return;
      }

      // M3.8 anaphora: anaphorize at most ONE interpolated endpoint per
      // support sentence. Anaphorizing both turns "The argument that
      // <source> provides grounding for <target>" into "The argument
      // that the same validity claim provides grounding for the same
      // thesis" — the reader loses both endpoints. Prefer to anaphorize
      // the target (typically the thesis); fall back to source-only if
      // target hasn't been seen yet.
      const renderedSet = (options as any)._renderedConclusionKeys as Set<string> | undefined;
      const sourceKey = normalizeConclusionKey(rawSource);
      const targetKey = normalizeConclusionKey(rawTarget);
      const sourceSeen = !!(renderedSet && sourceKey && renderedSet.has(sourceKey));
      const targetSeen = !!(renderedSet && targetKey && renderedSet.has(targetKey));
      // M3.8: when source and target are the SAME claim (e.g. a node
      // that supports the chain thesis and itself concludes the
      // thesis) AND both have already been rendered upstream, the
      // support template collapses to a tautology ("Evidence that
      // <thesis> lends credence to <thesis>"). Emit a short collapse
      // sentence instead so the reader sees "the same claim is
      // independently buttressed — <description>" rather than the
      // doubled interpolation.
      const isSelfSupport = !!(sourceKey && targetKey && sourceKey === targetKey);
      if (isSelfSupport && sourceSeen && targetSeen) {
        const dedupedDesc = dedupeAttackDescription(edge.description, options);
        const tail = dedupedDesc
          ? ` — ${dedupedDesc.trim().replace(/\.+$/, "")}.`
          : ".";
        supportDescriptions.push(
          `The same claim receives a further independent strand of support${tail}`
        );
        return;
      }
      let sourceText: string;
      let targetText: string;
      if (targetSeen) {
        targetText = smartLowercase(npAnaphor(rawTarget, options));
        if (renderedSet && sourceKey && !sourceSeen) renderedSet.add(sourceKey);
        sourceText = smartLowercase(rawSource);
      } else if (sourceSeen) {
        sourceText = smartLowercase(npAnaphor(rawSource, options));
        if (renderedSet && targetKey) renderedSet.add(targetKey);
        targetText = smartLowercase(rawTarget);
      } else {
        if (renderedSet && sourceKey) renderedSet.add(sourceKey);
        if (renderedSet && targetKey) renderedSet.add(targetKey);
        sourceText = smartLowercase(rawSource);
        targetText = smartLowercase(rawTarget);
      }

      // Vary the support phrasing
      const supportPhrases = [
        `The recognition that ${sourceText} strengthens the case for ${targetText}`,
        `Evidence that ${sourceText} lends credence to ${targetText}`,
        `The argument that ${sourceText} provides grounding for ${targetText}`,
        `Demonstrating ${sourceText} bolsters the claim that ${targetText}`,
      ];
      
      // Build strength context naturally (ends with period for clean sentence flow)
      const strengthContext = edge.strength && edge.strength > 0.7 
        ? " — a substantial contribution to the overall argument."
        : edge.strength && edge.strength < 0.4 
          ? " — though this support is modest."
          : "";
      
      // Clean edge description and build final sentence (M3.8: dedupe
      // attack-style descriptions so the same em-dash continuation
      // doesn't echo here and in J's fallen-objections render).
      let description = "";
      const dedupedDesc = dedupeAttackDescription(edge.description, options);
      if (dedupedDesc) {
        const cleanedDesc = dedupedDesc.replace(/\.+$/, "");
        // If we have strength context, edge description is a new sentence
        description = strengthContext 
          ? ` ${cleanedDesc.charAt(0).toUpperCase() + cleanedDesc.slice(1)}.`
          : `. ${cleanedDesc}.`;
      } else {
        description = strengthContext ? "" : ".";
      }
      
      supportDescriptions.push(
        `${sample(supportPhrases)}${strengthContext}${description}`
      );
    });
    
    if (supportDescriptions.length === 1) {
      parts.push(supportDescriptions[0]);
    } else if (supportDescriptions.length > 1) {
      parts.push(
        `Multiple lines of support converge in this argument structure. ${supportDescriptions.slice(0, 3).join(" Furthermore, ")}`
      );
    }
  }
  
  // Describe enabling relationships (more flowing)
  if (enableEdges.length > 0) {
    const enablePairs = enableEdges.map(edge => {
      const source = nodeMap.get(edge.sourceNodeId);
      const target = nodeMap.get(edge.targetNodeId);
      if (!source || !target) return null;
      
      const sourceText = smartLowercase(getArgumentConclusion(source).replace(/\.$/, ""));
      const targetText = smartLowercase(getArgumentConclusion(target).replace(/\.$/, ""));
      
      return { sourceText, targetText };
    }).filter(Boolean);
    
    if (enablePairs.length === 1) {
      const p = enablePairs[0]!;
      parts.push(
        `Critically, establishing ${p.sourceText} enables the subsequent consideration of ${p.targetText}, creating a logical dependency in the argumentative structure.`
      );
    } else if (enablePairs.length > 1) {
      parts.push(
        `The argumentative structure reveals important dependencies: certain claims must be established before others become viable. ${enablePairs.slice(0, 2).map(p => `Demonstrating ${p!.sourceText} opens the path to ${p!.targetText}`).join("; ")}.`
      );
    }
  }
  
  // Describe presuppositions (more elegant)
  if (presupposesEdges.length > 0) {
    const presupPairs = presupposesEdges.map(edge => {
      const source = nodeMap.get(edge.sourceNodeId);
      const target = nodeMap.get(edge.targetNodeId);
      if (!source || !target) return null;
      return {
        sourceText: smartLowercase(getArgumentConclusion(source).replace(/\.$/, "")),
        targetText: smartLowercase(getArgumentConclusion(target).replace(/\.$/, ""))
      };
    }).filter(Boolean);
    
    if (presupPairs.length > 0) {
      parts.push(
        `Underlying the explicit arguments are foundational presuppositions that structure the discourse. ` +
        `${presupPairs.slice(0, 2).map(p => `The claim that ${p!.sourceText} presupposes ${p!.targetText}`).join("; ")}.`
      );
    }
  }
  
  // Describe qualifications (more nuanced)
  if (qualifiesEdges.length > 0) {
    const qualPairs = qualifiesEdges.map(edge => {
      const source = nodeMap.get(edge.sourceNodeId);
      const target = nodeMap.get(edge.targetNodeId);
      if (!source || !target) return null;
      return {
        sourceText: smartLowercase(getArgumentConclusion(source).replace(/\.$/, "")),
        targetText: smartLowercase(getArgumentConclusion(target).replace(/\.$/, ""))
      };
    }).filter(Boolean);
    
    if (qualPairs.length === 1) {
      const q = qualPairs[0]!;
      parts.push(
        `Importantly, the argument is qualified: ${q.sourceText} introduces conditions that refine our understanding of ${q.targetText}.`
      );
    } else if (qualPairs.length > 1) {
      parts.push(
        `${qualifiesEdges.length} qualifications introduce essential nuance to the argument chain, ensuring the conclusions apply under appropriate conditions and avoiding overgeneralization.`
      );
    }
  }
  
  return parts.join("\n\n");
}

/**
 * Generate conclusion synthesizing the chain
 * Creates a thoughtful conclusion that synthesizes the argumentative journey
 */
// ===== M3: Refusal-surface helpers =====
//
// `buildBlockedNodeIds` translates a refusalSurface (which references
// *claim* ids) into the *node* ids local to this chain so the renderer
// can do O(1) lookups while walking nodes. Returns an empty set when no
// surface is supplied, which is the no-op fast path.
function buildBlockedNodeIds(
  nodes: ArgumentChainNodeWithArgument[],
  refusalSurface: EssayOptions["refusalSurface"]
): Set<string> {
  if (!refusalSurface?.blockedClaimIds?.length) return new Set();
  const blockedClaims = new Set(refusalSurface.blockedClaimIds);
  const out = new Set<string>();
  for (const n of nodes) {
    const cid = (n as any).argument?.conclusion?.id as string | undefined;
    if (cid && blockedClaims.has(cid)) out.add(n.id);
  }
  return out;
}

// `renderBlockedQuestion` formats a blocked claim as an open question
// without a terminating period. Callers are responsible for the trailing
// punctuation (typically "?" or "; "), so a single helper can serve both
// inline ("the question whether X") and standalone ("Whether X?") uses.
function renderBlockedQuestion(claimText: string): string {
  return `whether ${smartLowercase(claimText.replace(/\.$/, ""))}`;
}

// `composeRefusalBanner` produces the single-line caveat that closes the
// conclusion when any blocked claim was surfaced. We name the weakest
// link by label (curator-supplied) so the reader can act on the next
// objection rather than just learn the chain is "blocked".
function composeRefusalBanner(
  refusalSurface: NonNullable<EssayOptions["refusalSurface"]>
): string {
  const n = refusalSurface.blockedClaimIds.length;
  const noun = n === 1 ? "objection" : "objections";
  // M3.6 D: strip a trailing period from the curator label so the banner
  // doesn't render "… US adult population.. Do not read…" (double dot).
  const rawLabel = refusalSurface.weakestLinkLabel?.trim().replace(/\.+$/, "") ?? "";
  const weak = rawLabel ? ` the weakest link is ${rawLabel}` : "";
  return `This chain's conclusion remains blocked by ${spellOut(n)} unanswered ${noun};${weak}. Do not read the above as a closed verdict.`;
}


//
// `pickInlineTransition` returns the discourse-marker sentence that should
// precede a paragraph when a previously-rendered node has an edge into the
// current node. The returned string is empty when no qualifying edge exists
// (e.g. the only inbound edge is from a not-yet-rendered node, or its
// `strength` is below `edgeStrengthThreshold`). The caller is responsible
// for prepending the result, separated by a blank line, so that the prose
// reads as continuous discourse rather than a list of disjoint paragraphs.
function pickInlineTransition(
  targetNodeId: string,
  renderedIds: Set<string>,
  edges: ArgumentChainEdgeWithNodes[],
  nodeMap: Map<string, ArgumentChainNodeWithArgument>,
  threshold: number,
  options: EssayOptions
): string {
  // Prefer attacks (REBUTS / UNDERCUTS / UNDERMINES / REFUTES) over supports
  // when both are present, because the contrastive transition carries more
  // discourse information than a confirmatory one.
  const priority: string[] = [
    "REBUTS", "UNDERCUTS", "UNDERMINES", "REFUTES",
    "QUALIFIES", "SUPPORTS", "PRESUPPOSES", "ENABLES",
    "EXEMPLIFIES", "GENERALIZES",
  ];
  const incoming = edges
    .filter(e => e.targetNodeId === targetNodeId && renderedIds.has(e.sourceNodeId))
    .filter(e => {
      const s = (e as any).strength;
      return typeof s !== "number" || s >= threshold;
    });
  if (incoming.length === 0) return "";
  incoming.sort((a, b) => priority.indexOf(a.edgeType) - priority.indexOf(b.edgeType));
  const edge = incoming[0];
  const source = nodeMap.get(edge.sourceNodeId);
  if (!source) return "";
  const phrases = EDGE_NARRATIVE_TRANSITIONS[edge.edgeType] || EDGE_NARRATIVE_TRANSITIONS["REFUTES"];
  const phrase = sample(phrases);
  // M3.8: anaphorize the splice's source conclusion so a node whose
  // conclusion duplicates an earlier-rendered claim (e.g. a defensive
  // node whose conclusion is the defended thesis) doesn't restate the
  // thesis verbatim inside "However, this is rebutted by the claim
  // that <thesis>" or "Even granting the premise, this inference is
  // undercut by <thesis>".
  const sourceText = smartLowercase(npAnaphor(getArgumentConclusion(source).replace(/\.$/, ""), options));
  // If the edge has a curator-supplied `description`, promote it to a
  // relative clause so the transition carries the explicit reason rather
  // than a vague "this". M3.8: also route through dedupeAttackDescription
  // so the same description never echoes here and in J's fallen-objections
  // render.
  const rawDesc = (edge as any).description as string | undefined;
  const description = dedupeAttackDescription(rawDesc, options);
  if (description && description.trim().length > 0) {
    return `${phrase} ${sourceText} — ${description.trim().replace(/\.$/, "")}.`;
  }
  return `${phrase} ${sourceText}.`;
}

// ===== M2b: Role-keyed paragraph openers =====
//
// `roleOpener` returns a short discourse marker that frames a paragraph
// by its `dialecticalRole`. We only emit a marker for non-THESIS roles
// (THESIS paragraphs read fine without scaffolding) and only when no
// inline edge transition has already been prepended; otherwise the
// reader gets two opening cues in a row.
function roleOpener(role: string | null | undefined): string {
  switch (role) {
    case "ANTITHESIS":  return "Against this view, ";
    case "SYNTHESIS":   return "Synthesizing these strands, ";
    case "RESPONSE":    return "In response, ";
    case "CONCESSION":  return "Granting this, ";
    default:            return "";
  }
}

// M3.8 H: strip a reasoning-type opener from the start of a paragraph
// body when an outer discourse marker (role opener / inline edge
// transition) will be prepended. The four reasoning-type openers
// emitted by `generateArgumentProse` are sentence leads, not phrases
// that compose with a discourse cue. Without stripping we get stacked
// openers like "Against this view, the evidence points to an important
// conclusion: <thesis>". The reasoning type is still conveyed by the
// warrant / premise framing downstream.
const REASONING_OPENER_PREFIXES = [
  "The evidence points to an important conclusion: ",
  "The most plausible explanation is that ",
  "From a practical standpoint, ",
  "It follows that ",
];
function stripReasoningOpener(body: string): string {
  if (!body) return body;
  for (const prefix of REASONING_OPENER_PREFIXES) {
    if (body.startsWith(prefix)) {
      const rest = body.slice(prefix.length);
      // The remainder starts with the conclusion; for "It follows that"
      // and "the most plausible explanation is that" the conclusion was
      // already `smartLowercase`'d, while the "evidence points to"
      // branch leaves the conclusion title-cased after the colon.
      // Recapitalize the first character so the bare sentence reads as
      // a proper sentence start; the caller will lowercase it again if
      // a comma-trailing opener is being prepended.
      if (!rest) return rest;
      return rest[0].toUpperCase() + rest.slice(1);
    }
  }
  return body;
}

// ===== M2d: Conclusion synthesis inputs =====
//
// `conclusionSynthesisInputs` returns the structured standings of the
// chain so both the essay conclusion (here) and downstream Brief view
// (roadmap item 14) can share the same accounting. Three buckets:
//   * `surviving` — ASSERTED nodes that either have no incoming attacks
//     or whose attackers were themselves attacked (i.e. the attack was
//     neutralised). These are the premises the essay rests on.
//   * `fallen`    — attacker nodes whose attack was rebutted/undercut by
//     a downstream node, OR attackers that are themselves DENIED. We
//     surface (attacker, rebutter, description) so the conclusion can
//     name *why* the objection fell.
//   * `residual`  — QUESTIONED / SUSPENDED nodes that remain open. This
//     is the "contested band" the essay should not paper over.
type ConclusionSynthesis = {
  surviving: ArgumentChainNodeWithArgument[];
  fallen: Array<{
    attacker: ArgumentChainNodeWithArgument;
    target: ArgumentChainNodeWithArgument;
    rebutter: ArgumentChainNodeWithArgument | null;
    rebutDescription: string | null;
    attackDescription: string | null;
  }>;
  residual: ArgumentChainNodeWithArgument[];
};

export function conclusionSynthesisInputs(
  chain: ArgumentChainWithRelations
): ConclusionSynthesis {
  const nodes = chain.nodes || [];
  const edges = chain.edges || [];
  const nodeMap = new Map(nodes.map(n => [n.id, n] as const));
  const ATTACK = new Set(["REBUTS", "UNDERCUTS", "UNDERMINES", "REFUTES"]);

  const attacksByTarget = new Map<string, ArgumentChainEdgeWithNodes[]>();
  for (const e of edges) {
    if (!ATTACK.has(e.edgeType)) continue;
    const arr = attacksByTarget.get(e.targetNodeId) || [];
    arr.push(e);
    attacksByTarget.set(e.targetNodeId, arr);
  }
  // For each attacker, did anyone attack *it* in turn?
  const isAttacked = (id: string) => (attacksByTarget.get(id)?.length ?? 0) > 0;
  const isDenied = (n: ArgumentChainNodeWithArgument) =>
    (n as any).epistemicStatus === "DENIED";

  const surviving: ArgumentChainNodeWithArgument[] = [];
  const residual: ArgumentChainNodeWithArgument[] = [];
  const fallen: ConclusionSynthesis["fallen"] = [];

  for (const node of nodes) {
    const status = (node as any).epistemicStatus as string | undefined;
    const incomingAttacks = attacksByTarget.get(node.id) || [];

    // Fallen objections: this node is itself an attacker (has outgoing
    // attack edge) AND has been neutralised — either it's DENIED, or it
    // was itself attacked by a still-standing node.
    const outgoingAttacks = edges.filter(
      e => e.sourceNodeId === node.id && ATTACK.has(e.edgeType)
    );
    if (outgoingAttacks.length > 0) {
      const neutralised = isDenied(node) || isAttacked(node.id);
      if (neutralised) {
        const rebutEdge = (attacksByTarget.get(node.id) || [])[0];
        const rebutter = rebutEdge ? nodeMap.get(rebutEdge.sourceNodeId) || null : null;
        const target = nodeMap.get(outgoingAttacks[0].targetNodeId);
        if (target) {
          fallen.push({
            attacker: node,
            target,
            rebutter,
            rebutDescription: (rebutEdge as any)?.description ?? null,
            attackDescription: (outgoingAttacks[0] as any)?.description ?? null,
          });
          continue;
        }
      }
    }

    if (status === "QUESTIONED" || status === "SUSPENDED") {
      residual.push(node);
      continue;
    }
    if (status === "DENIED") {
      // Already counted as fallen above when it was an attacker; otherwise
      // it's a discarded claim we needn't reassert.
      continue;
    }
    // ASSERTED (or unspecified): surviving iff no live attack remains.
    const liveAttack = incomingAttacks.some(e => {
      const src = nodeMap.get(e.sourceNodeId);
      if (!src) return false;
      if (isDenied(src)) return false;
      if (isAttacked(src.id)) return false;     // attacker was itself attacked
      return true;
    });
    if (!liveAttack) surviving.push(node);
    else residual.push(node);                    // still under live challenge
  }

  return { surviving, fallen, residual };
}

function generateEssayConclusion(
  chain: ArgumentChainWithRelations,
  structure: NarrativeStructure,
  options: EssayOptions
): string {
  const parts: string[] = [];
  const { surviving, fallen, residual } = conclusionSynthesisInputs(chain);

  // (1) Surviving premises. Name them — the reader should be able to
  // re-derive the standing of each load-bearing claim from the conclusion
  // alone without re-reading the body.
  if (surviving.length > 0) {
    // M3.7 (Bug I): dedupe by normalized conclusion text. Chains often
    // contain multiple nodes whose conclusions phrase the same claim
    // (defended thesis variants); listing them verbatim made the
    // "Taking stock" sentence repeat itself. Keep the first occurrence
    // and recompute the count so the spelled-out number matches the list.
    const seenNames = new Set<string>();
    const uniqueNames: string[] = [];
    for (const n of surviving) {
      const raw = smartLowercase(getArgumentConclusion(n).replace(/\.$/, ""));
      const key = raw.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seenNames.has(key)) continue;
      seenNames.add(key);
      uniqueNames.push(raw);
      if (uniqueNames.length >= 4) break;
    }
    const count = uniqueNames.length;
    const list = count === 1
      ? uniqueNames[0]
      : uniqueNames.slice(0, -1).join("; ") + "; and " + uniqueNames[count - 1];
    parts.push(
      `Taking stock, ${spellOut(count)} premise${count > 1 ? "s" : ""} ` +
      `survive${count > 1 ? "" : "s"} the foregoing exchange: ${list}.`
    );
  } else if (structure.mainThesis) {
    // Fallback: if the standings computation found no clearly-surviving
    // premise (e.g. every node is QUESTIONED), still anchor the reader to
    // the thesis under examination.
    const thesisText = smartLowercase(getArgumentConclusion(structure.mainThesis).replace(/\.$/, ""));
    parts.push(`No premise emerged unchallenged, though the analysis turned on whether ${thesisText}.`);
  }

  // (2) Fallen objections. One clause per neutralised attacker, with the
  // rebutter named when available so the reader knows *why* the objection
  // fell rather than just *that* it did.
  if (fallen.length > 0) {
    const clauses = fallen.slice(0, 3).map(f => {
      // M3.7 (Bug J): prefer the attack-edge description over the
      // attacker node's conclusion. Chains commonly reuse the defended
      // thesis text as the conclusion of a defensive node that itself
      // launches an attack — rendering that conclusion under
      // "the objection that…" misattributes the thesis as an objection.
      // The edge description ("M's symmetry attack…") names the actual
      // dialectical move; fall back to the target's conclusion when no
      // edge description is available.
      const attackDesc = (f.attackDescription || "").trim().replace(/\.$/, "");
      const targetText = smartLowercase(getArgumentConclusion(f.target).replace(/\.$/, ""));
      const objection = attackDesc
        ? `the objection that ${smartLowercase(attackDesc)}`
        : `the objection to ${targetText}`;
      const rebutterText = f.rebutter
        ? smartLowercase(getArgumentConclusion(f.rebutter).replace(/\.$/, ""))
        : null;
      // M3.8 attack-desc dedupe: when the rebut description has already
      // been emitted (e.g. by `generateDialecticalExchange` or by a
      // support-edge description splice), drop the em-dash continuation
      // and fall back to the rebutter-named or bare "did not survive"
      // form. The reader has already seen the rebuttal text in context.
      const dedupedRebut = dedupeAttackDescription(f.rebutDescription, options);
      if (dedupedRebut) {
        return `${objection} was undermined — ${dedupedRebut.trim().replace(/\.$/, "")}`;
      }
      if (rebutterText) {
        return `${objection} was undermined by the rejoinder that ${rebutterText}`;
      }
      return `${objection} did not survive scrutiny`;
    });
    parts.push(
      `Among the objections raised, ${clauses.join("; ")}.`
    );
  }

  // (3) Residual contested band. Anything QUESTIONED/SUSPENDED that
  // hasn't been resolved — framed as open *questions* (not assertions)
  // so the conclusion can't be read as endorsing the contested claims.
  // M3: when any residual entry is in the refusal surface we close the
  // sentence with `?` rather than `.` so the rendered text never
  // produces "<blocked claim>." anywhere in the essay.
  const blockedNodeIds =
    ((options as any)._blockedNodeIds as Set<string> | undefined) ?? new Set();
  if (residual.length > 0) {
    const items = residual.slice(0, 3).map(n => {
      // M3.8: route residual-band entries through `npAnaphor` so a
      // chain whose blocked node IS the defended thesis renders as
      // "whether the same validity claim" / "whether the same thesis"
      // instead of restating the full thesis sentence inside the
      // conclusion paragraph.
      const rawConc = getArgumentConclusion(n).replace(/\.$/, "");
      const concText = smartLowercase(npAnaphor(rawConc, options));
      // If npAnaphor returned a short NP (anaphor case), the bare
      // "whether <NP>" phrase is ungrammatical ("whether the same
      // position."). Reword as a complete clause referring back to
      // the prior claim.
      const isAnaphor = THESIS_NP_ANAPHORS.some(
        (np) => concText === np.toLowerCase()
      );
      return {
        text: isAnaphor
          ? `whether ${concText} stands`
          : `whether ${concText}`,
        blocked: blockedNodeIds.has(n.id),
      };
    });
    // M3.6 E: dedupe residual entries by their normalized question text so
    // chains where multiple blocked nodes share the same conclusion (e.g.
    // three undercuts of the same chain-thesis) render the question once
    // instead of "whether <X>; whether <X>; and whether <X>".
    const seen = new Set<string>();
    const uniqItems: typeof items = [];
    for (const it of items) {
      const key = it.text.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(key)) continue;
      seen.add(key);
      uniqItems.push(it);
    }
    const lastBlocked = uniqItems[uniqItems.length - 1].blocked;
    const term = lastBlocked ? "?" : ".";
    const list = uniqItems.length === 1
      ? uniqItems[0].text
      : uniqItems.slice(0, -1).map(i => i.text).join("; ") + "; and " + uniqItems[uniqItems.length - 1].text;
    parts.push(
      `A residual contested band persists, leaving open ${list}${term} ` +
      `These questions remain live and the conclusions above should be read against them.`
    );
  }

  // M3: explicit refusal banner. When the caller supplied a refusal
  // surface, append a one-line caveat naming the weakest link. This is
  // additive — we still render the standings paragraphs above — but
  // ensures the conclusion ends with the honest "blocked" framing rather
  // than the generic epistemic-humility closer.
  if (options.refusalSurface?.blockedClaimIds.length) {
    parts.push(composeRefusalBanner(options.refusalSurface));
  }

  // Add a single epistemic-humility closing — kept from the prior
  // implementation because it sets the right register for "defeasible
  // reasoning", but trimmed to one line so the synthesis above is what
  // the reader takes away.
  const epistemicClosings = [
    "As with all defeasible reasoning, these standings remain open to revision in light of new evidence or stronger counterarguments.",
    "These standings are provisional: the arguments give reasons for belief, not proof beyond doubt.",
  ];
  parts.push(sample(epistemicClosings));

  return parts.join("\n\n");
}

// ===== Main Essay Generation Function =====

/**
 * Generate a complete essay from an argument chain
 */
export function generateEssay(
  chain: ArgumentChainWithRelations,
  options: EssayOptions = {}
): EssayResult {
  const {
    tone = "deliberative",
    audienceLevel = "informed",
    includeSchemeReferences = true,
    includeCriticalQuestions = true,
    includePremiseStructure = true,
    includeDialectic = true,
    structureByScopes = true,
    handleNestedScopes = true,
    // M2: edges below this strength are too weak to merit an inline
    // discourse marker; we'd rather skip the transition than mislead the
    // reader into thinking a marginal challenge is load-bearing.
    edgeStrengthThreshold = 0.3,
    refusalSurface,
  } = options;
  
  const nodes = chain.nodes || [];
  const edges = chain.edges || [];
  const scopes = (chain as any).scopes || [];

  // M3: pre-compute the set of blocked node ids and inject onto a private
  // option key so the existing site functions (generateArgumentProse,
  // generateLogicalFlow, generateEssayConclusion) can consult it without
  // a wider signature change. Empty set when no surface was supplied.
  const blockedNodeIds = buildBlockedNodeIds(nodes, refusalSurface);
  // M3.5 #2 / #5: track which premise texts and critical-question keys have
  // already been surfaced so downstream paragraphs do not repeat verbatim
  // evidence lists or scheme CQs across sibling nodes.
  const innerOptions: EssayOptions & {
    _blockedNodeIds?: Set<string>;
    _renderedCqKeys?: Set<string>;
    _renderedPremiseTexts?: Set<string>;
    _renderedBoilerplateKeys?: Set<string>;
    _renderedConclusionKeys?: Set<string>;
    _thesisAnaphorCursor?: { i: number };
    _thesisSentenceAnaphorCursor?: { i: number };
    _renderedAttackDescriptions?: Set<string>;
  } = {
    ...options,
    _blockedNodeIds: blockedNodeIds,
    _renderedCqKeys: new Set<string>(),
    _renderedPremiseTexts: new Set<string>(),
    _renderedBoilerplateKeys: new Set<string>(),
    _renderedConclusionKeys: new Set<string>(),
    _thesisAnaphorCursor: { i: 0 },
    _thesisSentenceAnaphorCursor: { i: 0 },
    _renderedAttackDescriptions: new Set<string>(),
  } as any;
  
  // Phase C: Group nodes by scope
  const { mainNodes, scopeSections } = structureByScopes 
    ? groupNodesForEssay(nodes, scopes)
    : { mainNodes: nodes, scopeSections: [] };
  
  // Analyze structure for narrative arc (using main nodes for structure)
  const structure = analyzeNarrativeStructure(mainNodes, edges);
  
  // Generate essay sections
  const opening = generateOpening(chain, structure, innerOptions);
  
  // Phase C: Add scope overview to opening if scopes exist
  let enhancedOpening = opening;
  if (structureByScopes && scopeSections.length > 0) {
    const scopeOverview = generateScopeOverview(scopeSections);
    enhancedOpening = `${opening}\n\n${scopeOverview}`;
  }
  
  // Main body: arguments woven together
  const bodyParts: string[] = [];

  // M2b/M2c: track nodes we've already rendered so the next paragraph can
  // open with the appropriate inline transition (REBUTS → "By contrast,"
  // etc.) and a role-keyed discourse marker. Wrapped in a single helper
  // so every push-site honours the same wiring.
  const renderedIds = new Set<string>();
  const nodeIndexMap = new Map(nodes.map(n => [n.id, n] as const));
  const pushNodeParagraph = (node: ArgumentChainNodeWithArgument) => {
    const scheme = extractSchemeMetadata(node);
    const premises = getArgumentPremises(node);
    const warrant = getImplicitWarrant(node);
    const transition = pickInlineTransition(
      node.id, renderedIds, edges, nodeIndexMap, edgeStrengthThreshold, innerOptions
    );
    const role = (node as any).dialecticalRole as string | null | undefined;
    const opener = transition ? "" : roleOpener(role);
    const body = generateArgumentProse(node, scheme, premises, warrant, innerOptions);
    // M3.8 H: when a role opener ("Against this view, ", "In response, "
    // …) is being prepended, strip any reasoning-type opener from the
    // start of the body so we don't produce stacked discourse cues like
    // "Against this view, the evidence points to an important
    // conclusion: <X>". The reasoning type is still carried by the
    // warrant / premise framing downstream.
    const strippedBody = opener ? stripReasoningOpener(body) : body;
    // When the opener ends in ", " we lowercase the next character so the
    // paragraph reads as a continuation rather than a hard new sentence.
    const continued = opener && strippedBody.length > 0
      ? opener + strippedBody[0].toLowerCase() + strippedBody.slice(1)
      : strippedBody;
    const composed = [transition, continued]
      .filter(Boolean)
      .join("\n\n");
    bodyParts.push(composed);
    renderedIds.add(node.id);
  };

  // First, present opening arguments (from main/unscoped nodes)
  const unscopedOpening = structure.openingArguments.filter(n => !(n as any).scopeId);
  if (unscopedOpening.length > 0) {
    unscopedOpening.forEach(pushNodeParagraph);
  }
  
  // Present dialectical exchanges if any (from main/unscoped nodes)
  if (includeDialectic && structure.dialecticalPairs.length > 0) {
    const unscopedPairs = structure.dialecticalPairs.filter(
      p => !(p.thesis as any).scopeId && !(p.antithesis as any).scopeId
    );
    if (unscopedPairs.length > 0) {
      bodyParts.push("\n---\n"); // Thematic break
      unscopedPairs.forEach(pair => {
        bodyParts.push(generateDialecticalExchange(pair, edges, options));
        // Mark the pair's nodes as rendered so later inline transitions
        // don't double-introduce them.
        renderedIds.add(pair.thesis.id);
        renderedIds.add(pair.antithesis.id);
        if (pair.synthesis) renderedIds.add(pair.synthesis.id);
      });
    }
  }
  
  // Present developing arguments (from main/unscoped nodes)
  if (structure.developingArguments.length > 0) {
    const developingNodes = structure.developingArguments
      .filter(n => !(n as any).scopeId)
      .filter(n => !structure.dialecticalPairs.some(
        p => p.thesis.id === n.id || p.antithesis.id === n.id
      ));
    
    developingNodes.forEach(pushNodeParagraph);
  }
  
  // Present resolution arguments (from main/unscoped nodes)
  if (structure.resolutionArguments.length > 0) {
    const resolutionNodes = structure.resolutionArguments
      .filter(n => !(n as any).scopeId)
      .filter(n => !structure.dialecticalPairs.some(p => p.synthesis?.id === n.id));
    
    resolutionNodes.forEach(pushNodeParagraph);
  }
  
  // Phase C: Generate scope sections
  if (structureByScopes && scopeSections.length > 0) {
    bodyParts.push("\n---\n"); // Section break before scopes
    const nodeIndex = { current: mainNodes.length };
    
    scopeSections.forEach(scope => {
      const scopeContent = generateScopeEssaySection(scope, options, nodeIndex);
      bodyParts.push(scopeContent);
    });
  }
  
  // Logical flow analysis (optional section)
  const logicalFlow = generateLogicalFlow(nodes, edges, innerOptions);
  
  // Essay conclusion
  const conclusion = generateEssayConclusion(chain, structure, innerOptions);
  
  // Phase C: Enhance conclusion with scope summary
  let enhancedConclusion = conclusion;
  if (structureByScopes && scopeSections.length > 0) {
    enhancedConclusion = `${conclusion}\n\n${generateScopeConclusion(scopeSections)}`;
  }
  
  // Compose full text
  const title = chain.name || "Argument Analysis";
  const abstract = chain.description || 
    `An analysis of ${nodes.length} interconnected arguments examining ${chain.purpose || "the matter at hand"}.`;
  
  const body = [
    ...bodyParts,
    logicalFlow ? `\n---\n\n${logicalFlow}` : "",
  ].filter(Boolean).join("\n\n");
  
  const fullText = [
    `# ${title}`,
    "",
    `*${abstract}*`,
    "",
    "---",
    "",
    enhancedOpening,
    "",
    body,
    "",
    "---",
    "",
    enhancedConclusion,
  ].join("\n");
  
  // Count words
  const wordCount = fullText.split(/\s+/).length;
  
  // Count unique schemes
  const schemeKeys = new Set(
    nodes
      .map(n => extractSchemeMetadata(n)?.key)
      .filter(Boolean)
  );
  
  return {
    title,
    abstract,
    body,
    fullText,
    wordCount,
    metadata: {
      chainId: chain.id,
      argumentCount: nodes.length,
      schemeCount: schemeKeys.size,
      dialecticalMoves: structure.dialecticalPairs.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Generate essay as plain text (no markdown)
 */
export function generateEssayText(
  chain: ArgumentChainWithRelations,
  options?: EssayOptions
): string {
  const result = generateEssay(chain, options);
  // Strip markdown formatting
  return result.fullText
    .replace(/^# /gm, "")
    .replace(/^\*([^*]+)\*$/gm, "$1")
    .replace(/^---$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}
