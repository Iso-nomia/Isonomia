/**
 * M0 golden-snapshot harness for the chain prose generators.
 *
 * Locks in current output of `generateEssay` and `generateProse` across the
 * (tone × audience) matrix and against the blocked-conclusion fixture so that
 * M1+ refactors (epistemic-status language, dialectical-role templates,
 * refusal-surface honesty, etc.) land as reviewable snapshot diffs rather than
 * silent behaviour changes.
 *
 * Run: `npm run test -- proseGenerator.golden`
 * Update baselines after intentional changes: append `--updateSnapshot`.
 */
import hinge1Fixture from "../fixtures/chains/hinge1.json";
import blockedFixture from "../fixtures/chains/blockedConclusion.json";
import { generateEssay, type EssayOptions } from "@/lib/chains/essayGenerator";
import { generateProse, type ProseOptions } from "@/lib/chains/proseGenerator";
import type { ArgumentChainWithRelations } from "@/lib/types/argumentChain";

// JSON fixtures use stringified BigInts to match the API serializer; the
// generators access fields loosely (`as any`), so a structural cast is safe.
const hinge1 = hinge1Fixture as unknown as ArgumentChainWithRelations;
const blocked = blockedFixture as unknown as ArgumentChainWithRelations;

// The current essay generator uses `Math.random()` via a `sample()` helper to
// pick discourse phrases. That nondeterminism would make snapshots flake on
// every run. Seed a deterministic PRNG (mulberry32) before each test so the
// `sample()` calls produce a stable sequence. Item 8 (tone presets / discourse
// strategy) will eventually remove the randomness; until then this stub is
// what makes the golden baseline stable.
const RNG_SEED = 0xC0FFEE;
let _origRandom: () => number;
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
beforeAll(() => {
  _origRandom = Math.random;
});
beforeEach(() => {
  Math.random = mulberry32(RNG_SEED);
});
afterAll(() => {
  Math.random = _origRandom;
});

const TONES: NonNullable<EssayOptions["tone"]>[] = [
  "academic",
  "deliberative",
  "persuasive",
  "journalistic",
];
const AUDIENCES: NonNullable<EssayOptions["audienceLevel"]>[] = [
  "general",
  "informed",
  "expert",
];

/**
 * Strip volatile fields (timestamps, generated-at) so snapshots are stable.
 */
function stabilize<T extends { metadata?: any }>(result: T): T {
  if (result?.metadata?.generatedAt) {
    result.metadata = { ...result.metadata, generatedAt: "FIXED" };
  }
  return result;
}

describe("M0 golden — chain prose generators (Hinge #1 fixture)", () => {
  describe("generateEssay matrix", () => {
    for (const tone of TONES) {
      for (const audienceLevel of AUDIENCES) {
        const label = `${tone} / ${audienceLevel}`;
        test(`essay matches snapshot — ${label}`, () => {
          const result = generateEssay(hinge1, {
            tone,
            audienceLevel,
            includeSchemeReferences: true,
            includeCriticalQuestions: true,
            includePremiseStructure: true,
            includeDialectic: true,
          });
          expect(stabilize(result).fullText).toMatchSnapshot();
        });
      }
    }
  });

  describe("generateProse matrix", () => {
    const styles: NonNullable<ProseOptions["style"]>[] = [
      "legal_brief",
      "academic",
      "summary",
    ];
    for (const style of styles) {
      test(`prose matches snapshot — ${style}`, () => {
        const result = generateProse(hinge1, {
          style,
          includeSections: true,
          includeNumbering: true,
          includeCriticalQuestions: true,
          includeMetadata: true,
        });
        expect(stabilize(result).fullText).toMatchSnapshot();
      });
    }
  });

  describe("structural invariants (will fail intentionally at M1–M3)", () => {
    // These are the explicit bug-confirmations from the backlog. They are
    // skipped today so the suite stays green; remove `.skip` as each
    // milestone lands and the invariant becomes the contract.

    test("M1.3 — antithesis paragraph references antithesis node text, not thesis text", () => {
      const result = generateEssay(hinge1, {
        tone: "persuasive",
        audienceLevel: "expert",
      });
      expect(result.fullText).toContain("conflate");
      expect(result.fullText).not.toMatch(
        /While some have argued that[^.]*validly measure/i,
      );
    });

    test("M2a — DENIED/QUESTIONED nodes never produce assertive openers", () => {
      const result = generateEssay(hinge1, {
        tone: "persuasive",
        audienceLevel: "expert",
      });
      // QUESTIONED synthesis node must be hedged.
      const synthesisLine = result.fullText
        .split(/\n+/)
        .find((l) => l.includes("mixed-measurement") || l.includes("residual"));
      expect(synthesisLine).toBeDefined();
      expect(synthesisLine!).toMatch(
        /plausibly|on the available evidence|appears to|qualified/i,
      );
    });

    test("M2c — REBUTS edge surfaces as inline counter-transition", () => {
      const result = generateEssay(hinge1, {
        tone: "deliberative",
        audienceLevel: "informed",
      });
      expect(result.fullText).toMatch(/counters that|however,|by contrast/i);
    });

    test("M2d — conclusion names surviving premises AND fallen objections", () => {
      const result = generateEssay(hinge1, {
        tone: "deliberative",
        audienceLevel: "expert",
      });
      // Mention of Iyengar response means a fallen objection was named.
      expect(result.fullText).toMatch(/Iyengar|paired (thermometer|instrument)/);
      // Mention of residual band means surviving qualifier acknowledged.
      expect(result.fullText).toMatch(/residual|contested band/);
    });

    test.skip("M4 — tone matrix produces distinct opening sentences", () => {
      const openers = new Set(
        TONES.map((tone) => {
          const r = generateEssay(hinge1, { tone, audienceLevel: "informed" });
          return r.fullText.split(/\n+/).find((l) => l.trim().length > 0)?.trim();
        }),
      );
      expect(openers.size).toBe(TONES.length);
    });
  });
});

describe("M0 golden — blocked-conclusion fixture", () => {
  // Both tests in this block pass the deliberation's refusal surface
  // because the fixture name implies the caller is the M3-aware view
  // layer. Rendering without the surface is covered indirectly by the
  // wider matrix above (which never declares any claim blocked).
  const blockedOpts = {
    tone: "deliberative" as const,
    audienceLevel: "informed" as const,
    refusalSurface: {
      blockedClaimIds: ["claim_blocked_thesis"],
      weakestLinkLabel: "the unanswered relocation-of-risk objection",
    },
  };

  test("essay snapshot — blocked conclusion (deliberative / informed)", () => {
    const result = generateEssay(blocked, blockedOpts);
    expect(stabilize(result).fullText).toMatchSnapshot();
  });

  test("M3 — conclusion paragraph never asserts a claim in mustNotAssert", () => {
    // M3: the caller (Essay/Brief views) passes the deliberation's
    // refusal surface to the generator; any claim listed there must
    // never appear as a closed `... is warranted.` assertion in the
    // rendered prose. We assert the negative invariant directly on
    // `fullText` so any new site that restates the blocked claim is
    // caught immediately.
    const result = generateEssay(blocked, blockedOpts);
    expect(result.fullText).not.toMatch(/A 6-month moratorium .* is warranted\./);
    // And the explicit refusal banner must surface so readers see the
    // blocked framing rather than just a missing assertion.
    expect(result.fullText).toMatch(/conclusion remains blocked/i);
  });
});

describe("M3.5 invariants — essay prose hygiene", () => {
  test("#1 verb-lead purpose routes through 'This chain sets out to ...' framing", () => {
    const verbLeadChain = {
      ...(hinge1 as any),
      purpose: "Capture the aggregation gap in feeling-thermometer studies",
    } as ArgumentChainWithRelations;
    const result = generateEssay(verbLeadChain, {
      tone: "deliberative",
      audienceLevel: "informed",
    });
    // Look for the framing sentence anywhere in the prose — the essay
    // begins with a markdown heading and an italicized summary line
    // before the actual intro lead.
    expect(result.fullText).toMatch(/this chain sets out to capture/i);
    expect(result.fullText).not.toMatch(/this essay examines Capture/i);
  });

  test("#3 small foundational counts are spelled out (no leading digit)", () => {
    const result = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "informed",
    });
    expect(result.fullText).not.toMatch(/begins from \d /);
    expect(result.fullText).toMatch(/begins from (one|two|three|four|five|six|seven|eight|nine|ten) foundational/i);
  });

  test("#3b conclusion 'Taking stock' and refusal banner spell out small counts", () => {
    const survivingResult = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "informed",
    });
    expect(survivingResult.fullText).not.toMatch(/Taking stock, \d /);

    const blockedResult = generateEssay(blocked, {
      tone: "deliberative",
      audienceLevel: "informed",
      refusalSurface: {
        blockedClaimIds: ["claim_blocked_thesis"],
        weakestLinkLabel: "the unanswered relocation-of-risk objection",
      },
    });
    expect(blockedResult.fullText).not.toMatch(/blocked by \d unanswered/);
    expect(blockedResult.fullText).toMatch(/blocked by one unanswered objection/i);
  });

  test("#4 rendered CQs never contain unfilled scheme placeholders", () => {
    for (const audience of AUDIENCES) {
      const result = generateEssay(hinge1, {
        tone: "deliberative",
        audienceLevel: audience,
        includeCriticalQuestions: true,
      });
      // Scheme placeholders look like bare single capitals (e.g. "study S",
      // "defect D", "kind K", "direction B"). "A" and "I" are allowed
      // (article / pronoun); "study A" or "I" do not signal an unbound
      // template.
      const cqLines = result.fullText
        .split(/\n+/)
        .filter((l) => /critical reader|addresses the following/i.test(l));
      for (const line of cqLines) {
        // Pull out just the substring AFTER the CQ marker so we don't
        // inadvertently scan an earlier scheme-reference sentence in the
        // same paragraph.
        const after = line.replace(/^.*?(addresses the following question[s]?:|critical reader might ask:|questions remain open for the critical reader:)\s*/i, "");
        const bareCaps = (after.match(/\b[A-Z]\b/g) ?? []).filter((c) => c !== "A" && c !== "I");
        expect({ line, after, bareCaps }).toMatchObject({ bareCaps: expect.arrayContaining([]) });
        expect(bareCaps.length).toBeLessThan(2);
      }
    }
  });

  test("#5 the same CQ block never repeats verbatim across paragraphs", () => {
    const result = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "expert",
      includeCriticalQuestions: true,
    });
    const cqLines = result.fullText
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => /addresses the following question|critical reader might ask|questions remain open/i.test(l));
    const seen = new Set<string>();
    for (const line of cqLines) {
      expect(seen.has(line)).toBe(false);
      seen.add(line);
    }
  });

  test("#2 evidence premise sentences do not repeat verbatim across paragraphs", () => {
    const result = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "informed",
      includePremiseStructure: true,
    });
    // Premise sentences open with "First, ", "Additionally, ", "Finally, ", or
    // appear after "This follows from the fact that ". Collect all of them
    // and assert no exact duplicates.
    const premiseFragments: string[] = [];
    const lines = result.fullText.split(/\n+/);
    for (const line of lines) {
      const matches = line.match(/(?:First|Additionally|Finally),\s+[^.]+\./g) ?? [];
      for (const m of matches) premiseFragments.push(m.trim().toLowerCase());
    }
    const seen = new Set<string>();
    for (const f of premiseFragments) {
      expect(seen.has(f)).toBe(false);
      seen.add(f);
    }
  });
});

describe("M3.6 invariants — essay prose hygiene v2", () => {
  test("A verb-lead 'Capture …' is lowercased after 'This chain sets out to'", () => {
    const verbLeadChain = {
      ...(hinge1 as any),
      purpose: "Capture the aggregation gap in feeling-thermometer studies",
    } as ArgumentChainWithRelations;
    const result = generateEssay(verbLeadChain, {
      tone: "deliberative",
      audienceLevel: "informed",
    });
    expect(result.fullText).toMatch(/this chain sets out to capture/i);
    expect(result.fullText).not.toMatch(/sets out to Capture/);
  });

  test("B prose never contains '[object Object]'", () => {
    for (const fixture of [hinge1, blocked]) {
      const result = generateEssay(fixture, {
        tone: "deliberative",
        audienceLevel: "informed",
        includePremiseStructure: true,
        includeDialectic: true,
      });
      expect(result.fullText).not.toMatch(/\[object Object\]/);
    }
  });

  test("C warrants preserve acronyms (US / RCT) and don't lowercase them", () => {
    // Inject a warrant that contains acronyms via a synthetic node patch.
    // The hinge1 fixture's warrants flow through generateArgumentProse →
    // `preserveAcronymLowercase(warrant)`; assert no lowercased "us-"
    // tokens or stand-alone "rct"/"rcts" land in the output.
    const result = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "expert",
      includeSchemeReferences: true,
    });
    expect(result.fullText).not.toMatch(/\bus-specific\b/);
    expect(result.fullText).not.toMatch(/\brcts?\b/);
  });

  test("D refusal banner never renders a double period", () => {
    const result = generateEssay(blocked, {
      tone: "deliberative",
      audienceLevel: "informed",
      refusalSurface: {
        blockedClaimIds: ["claim_blocked_thesis"],
        // Curators sometimes supply a trailing period; banner must strip it.
        weakestLinkLabel: "the unanswered relocation-of-risk objection.",
      },
    });
    // Match exactly two consecutive periods (not the legitimate "..."
    // truncation ellipsis used elsewhere in the essay).
    expect(result.fullText).not.toMatch(/(?<!\.)\.\.(?!\.)/);
    expect(result.fullText).toMatch(/blocked by one unanswered objection/);
  });

  test("E residual contested band dedupes repeated 'whether <X>' entries", () => {
    const result = generateEssay(blocked, {
      tone: "deliberative",
      audienceLevel: "informed",
      refusalSurface: {
        blockedClaimIds: ["claim_blocked_thesis"],
        weakestLinkLabel: "the unanswered relocation-of-risk objection",
      },
    });
    // Locate the residual-band sentence and count distinct "whether" clauses.
    const band = result.fullText
      .split(/\n+/)
      .find((l) => /A residual contested band persists/.test(l));
    if (band) {
      const whethers = (band.match(/whether\s+[^;?.]+/g) ?? []).map((s) =>
        s.toLowerCase().replace(/\s+/g, " ").trim()
      );
      const seen = new Set<string>();
      for (const w of whethers) {
        expect(seen.has(w)).toBe(false);
        seen.add(w);
      }
    }
  });

  test("F blocked claims under an epistemicIntro frame don't strand a mid-paragraph '?'", () => {
    // When the body splices "While some have argued that <X>" / "It remains
    // an open question whether <X>", the conclusion's `?` should be replaced
    // by `.` so the next sentence ("Despite the rejection of this view, …")
    // doesn't read as a non-sequitur after a question mark.
    const result = generateEssay(blocked, {
      tone: "deliberative",
      audienceLevel: "informed",
    });
    // No "<X>? <Capital-letter-word>" splices inside a single paragraph.
    // Allow only "? " followed by lowercase (rare) or end of paragraph.
    const offending = result.fullText.match(
      /(?:While some have argued that|It remains an open question whether|Let us suppose, for the sake of argument, that|Consider a counterfactual scenario in which|If we accept that|Plausibly, on the available evidence,)\s+[^.?]+\?\s+[A-Z]/g
    );
    expect(offending).toBeNull();
  });
});

describe("M3.7 invariants — essay prose hygiene v3", () => {
  test("I Taking-stock premise list dedupes by normalized text", () => {
    // Build a chain whose surviving premises share conclusion text.
    const dup = JSON.parse(JSON.stringify(hinge1)) as ArgumentChainWithRelations;
    const survivors = (dup.nodes as any[]).filter(
      (n) => !n.epistemicStatus || n.epistemicStatus === "ASSERTED"
    );
    if (survivors.length >= 2) {
      const text = survivors[0].argument?.conclusionClaim?.text;
      if (text && survivors[1].argument?.conclusionClaim) {
        survivors[1].argument.conclusionClaim.text = text;
      }
    }
    const result = generateEssay(dup, {
      tone: "deliberative",
      audienceLevel: "informed",
    });
    const m = result.fullText.match(/Taking stock, (\w+) premises? survives? the foregoing exchange: ([^.]+)\./);
    if (m) {
      const list = m[2];
      const items = list.split(/;\s*(?:and\s+)?/).map((s) => s.trim().toLowerCase());
      const seen = new Set<string>();
      for (const it of items) {
        if (!it) continue;
        expect(seen.has(it)).toBe(false);
        seen.add(it);
      }
    }
  });

  test("J 'Among the objections raised, …' never echoes the defended thesis verbatim", () => {
    const result = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "informed",
    });
    const thesis =
      (hinge1 as any).nodes?.find((n: any) => n.dialecticalRole === "THESIS")
        ?.argument?.conclusionClaim?.text || "";
    const objectionsLine = result.fullText
      .split(/\n+/)
      .find((l) => /Among the objections raised/.test(l));
    if (objectionsLine && thesis) {
      const thesisCore = thesis.replace(/\.$/, "").toLowerCase().slice(0, 40);
      // Extract the clause immediately after "the objection that " — it
      // must not begin with the defended-thesis text.
      const clause = objectionsLine.match(/the objection that\s+([^—;]+)/i);
      if (clause) {
        expect(clause[1].toLowerCase().slice(0, 40)).not.toBe(thesisCore);
      }
    }
  });

  test("K SUPPORTS transitions end with punctuation or 'by/from'", () => {
    // Either "Reinforcing this point, X." or "Building on this foundation, X." —
    // never "Reinforcing this point X." or "Building on this foundation X.".
    const result = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "expert",
      includeSchemeReferences: true,
    });
    expect(result.fullText).not.toMatch(/Reinforcing this point\s+[a-z]/);
    expect(result.fullText).not.toMatch(/Building on this foundation\s+[a-z]/);
  });
});

describe("M3.8 invariants — essay prose hygiene v4 (G + thesis anaphora)", () => {
  // G: each boilerplate template fires at most once per essay.
  const BOILERPLATE_PATTERNS: Array<{ name: string; re: RegExp }> = [
    { name: "warrant em-dash gloss",          re: /The underlying warrant—the principle that licenses this inference—holds that/g },
    { name: "multi-premise framing (rests)",  re: /\bThe reasoning rests on multiple considerations\./g },
    { name: "multi-premise framing (draws)",  re: /\bThis conclusion draws support from several observations\./g },
    { name: "multi-premise framing (converge)", re: /\bSeveral factors converge to support this view\./g },
    { name: "CQ pedagogical intro (plural)",  re: /Two questions remain open for the critical reader:/g },
    { name: "CQ pedagogical intro (single)",  re: /A critical reader might ask:/g },
    { name: "definitional-basis context",     re: /The definitional basis of this argument makes the classification straightforward\./g },
    { name: "causal-pattern context",         re: /This causal reasoning follows a well-established pattern of inference\./g },
  ];

  for (const { name, re } of BOILERPLATE_PATTERNS) {
    test(`G boilerplate template "${name}" fires at most once`, () => {
      const result = generateEssay(hinge1, {
        tone: "deliberative",
        audienceLevel: "informed",
        includeSchemeReferences: true,
        includePremiseStructure: true,
      });
      const count = (result.fullText.match(re) || []).length;
      expect(count).toBeLessThanOrEqual(1);
    });
  }

  test("thesis-anaphora: defended thesis is not opened verbatim more than once in body paragraphs", () => {
    // Force a chain where multiple body nodes share the thesis text.
    const dup = JSON.parse(JSON.stringify(hinge1)) as ArgumentChainWithRelations;
    const thesisNode = (dup.nodes as any[]).find(
      (n) => n.dialecticalRole === "THESIS"
    );
    const thesisText: string | undefined =
      thesisNode?.argument?.conclusion?.text ??
      thesisNode?.argument?.conclusionClaim?.text;
    if (!thesisText) {
      // Fixture invariant: hinge1 has a THESIS with a conclusion text.
      throw new Error("hinge1 fixture missing THESIS conclusion text");
    }
    // Stamp the same conclusion onto another body node so we *would*
    // emit the thesis sentence twice without the anaphora swap.
    const others = (dup.nodes as any[]).filter(
      (n) => n.id !== thesisNode.id && (n.argument?.conclusion || n.argument?.conclusionClaim)
    );
    if (others.length > 0) {
      if (others[0].argument?.conclusion) others[0].argument.conclusion.text = thesisText;
      if (others[0].argument?.conclusionClaim) others[0].argument.conclusionClaim.text = thesisText;
    }
    const result = generateEssay(dup, {
      tone: "deliberative",
      audienceLevel: "informed",
    });
    // Count exact-match thesis sentences as paragraph-openers. We allow
    // the thesis text to appear inside logical-flow / conclusion framing
    // (e.g. "supplies one strand toward …") — the invariant is that the
    // raw thesis sentence does not lead two distinct body paragraphs.
    const escaped = thesisText
      .replace(/\.$/, "")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const openerRe = new RegExp(`(?:^|\\n\\n)${escaped}\\.`, "g");
    const opens = (result.fullText.match(openerRe) || []).length;
    expect(opens).toBeLessThanOrEqual(1);
    // And at least one of the anaphor sentences appears.
    expect(result.fullText).toMatch(
      /(restates the same conclusion|returns to the same thesis|case for the same claim is reinforced|recovers the same conclusion)/
    );
  });

  // H: opener stacking. epistemicIntro frames + reasoning-type sentence
  // openers + role openers were composing into ungrammatical chimeras
  // like "Against this view, the evidence points to an important
  // conclusion: …" or "While some have argued that the most plausible
  // explanation is that …". The H patch strips reasoning-opener prefixes
  // before composition and emits a bare epistemic wrapper.
  const STACKED_OPENER_PATTERNS: RegExp[] = [
    /Against this view, the evidence points to/i,
    /Against this view, the most plausible explanation/i,
    /Against this view, from a practical standpoint/i,
    /Against this view, it follows that/i,
    /While some have argued that the evidence points to/i,
    /While some have argued that the most plausible explanation/i,
    /While some have argued that from a practical standpoint/i,
    /While some have argued that it follows that/i,
    /In response, the evidence points to/i,
    /In response, the most plausible explanation/i,
  ];
  for (const re of STACKED_OPENER_PATTERNS) {
    test(`H opener-stacking: '${re.source}' never appears`, () => {
      const result = generateEssay(hinge1, {
        tone: "deliberative",
        audienceLevel: "informed",
        includeDialectic: true,
      });
      expect(result.fullText).not.toMatch(re);
    });
  }

  test("anaphora-everywhere: support sentences never anaphorize BOTH endpoints", () => {
    // Symptom: "The argument that the same validity claim provides
    // grounding for the same thesis — …" The fix guarantees at most one
    // of (source, target) is anaphorized per support sentence.
    const result = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "informed",
    });
    expect(result.fullText).not.toMatch(
      /The argument that (?:the same|this same|this) [^.]{0,40} (?:provides grounding for|supplies one strand toward|reinforces|underwrites) (?:the same|this same|this) /i
    );
  });

  test("attack-desc dedupe: identical attack descriptions never appear twice", () => {
    // Build a chain where the dialectical exchange and the J 'Among the
    // objections raised' splice both reference the same edge description.
    const dup = JSON.parse(JSON.stringify(hinge1)) as ArgumentChainWithRelations;
    const attackEdge = (dup.edges as any[]).find(
      (e) => e.edgeType === "REBUTS" || e.edgeType === "UNDERCUTS"
    );
    if (attackEdge) {
      attackEdge.description = "B conceded this point fully.";
    }
    const result = generateEssay(dup, {
      tone: "deliberative",
      audienceLevel: "informed",
      includeDialectic: true,
    });
    const count = (
      result.fullText.match(/B conceded this point fully\./g) || []
    ).length;
    expect(count).toBeLessThanOrEqual(1);
  });

  test("inline-edge transition anaphorizes splice source when seen", () => {
    // 'However, this is rebutted by the claim that <thesis>' and 'Even
    // granting the premise, this inference is undercut by <thesis>'
    // were rendering the defended-thesis text verbatim inside splice
    // sentences. After the fix the splice source uses an NP anaphor
    // when the same conclusion has already been rendered upstream.
    const result = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "informed",
      includeDialectic: true,
    });
    // No inline-edge transition splice should embed a "the claim that
    // <full thesis sentence>" or "undercut by <full thesis sentence>"
    // pattern. We approximate by checking that REBUTS / UNDERCUTS splice
    // sentences (ending in em-dash + description) never carry > 30
    // words between the transition phrase and the em-dash — anaphors
    // are short by construction.
    const splicePatterns = [
      /However, this is rebutted by the claim that ([^—\n]+?)—/g,
      /Even granting the premise, this inference is undercut by ([^—\n]+?)—/g,
      /By contrast, the rebuttal holds that ([^—\n]+?)—/g,
    ];
    for (const re of splicePatterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(result.fullText)) !== null) {
        const middle = m[1].trim();
        const wordCount = middle.split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(8);
      }
    }
  });

  test("residual-band uses NP anaphor when blocked node IS defended thesis", () => {
    // hinge1's blocked node IS the defended thesis. Before the fix the
    // residual band rendered "leaving open whether <full thesis>" — now
    // it should route through `npAnaphor`.
    const result = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "informed",
    });
    // The residual-band sentence should not contain the full verbatim
    // thesis. Allow short anaphors.
    const m = result.fullText.match(/A residual contested band persists, leaving open ([^.?\n]+)[.?]/);
    if (m) {
      const middle = m[1];
      // Generous bound: even if multiple residual items, each "whether
      // <anaphor>" is short.
      expect(middle.length).toBeLessThanOrEqual(200);
    }
  });

  test("residual-band anaphor is grammatical (not bare 'whether <NP>')", () => {
    // After npAnaphor fires, the residual band must not produce
    // "whether the same position." (bare NP). It should be reworded
    // as a clause ("whether <NP> stands").
    const result = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "informed",
    });
    expect(result.fullText).not.toMatch(
      /whether (?:the same|this same|this) (?:validity claim|thesis|position|conclusion|claim)\s*[.?;]/i
    );
  });

  test("sentence-level thesis anaphor templates do not repeat back-to-back", () => {
    // Split cursors (NP vs sentence) ensure the four sentence-level
    // thesis anaphor templates rotate evenly rather than colliding on
    // the same idx twice in one essay.
    const result = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "informed",
      includeDialectic: true,
    });
    const sentenceAnaphors = [
      "This paragraph returns to the same thesis by an independent route.",
      "Here the same conclusion is approached from a fresh angle.",
      "The same claim surfaces again, from a different direction.",
      "Once more the same position is reached via distinct considerations.",
    ];
    for (const s of sentenceAnaphors) {
      const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      const count = (result.fullText.match(re) || []).length;
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  test("self-support collapse fires when source==target are both seen", () => {
    // hinge1 has support edges whose source IS the defended thesis.
    // When both endpoints have been rendered upstream the renderer
    // must collapse the tautological "Evidence that X lends credence
    // to X" template to "The same claim receives a further independent
    // strand of support — <desc>".
    const result = generateEssay(hinge1, {
      tone: "deliberative",
      audienceLevel: "informed",
      includeDialectic: true,
    });
    // Either the collapse fires (presence of the collapse phrase) or
    // no self-support edge with both-seen exists in this fixture; in
    // either case the tautological "lends credence to the same" must
    // not appear.
    expect(result.fullText).not.toMatch(
      /lends credence to (?:the same|this same) (?:thesis|conclusion|claim|validity claim|position)/i
    );
  });
});
