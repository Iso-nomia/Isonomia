/**
 * Track AI-EPI E.1 / E.2 — pure-function tests for citation format
 * serializers and the iso: identifier scheme. No Prisma access.
 */

import {
  toCslJson,
  toBibTeX,
  toRis,
  toApa,
  toMla,
  toChicago,
  renderAuthorPlain,
  renderCitation,
  isCitationFormat,
} from "@/lib/citation/formats";
import {
  toIsoId,
  toIsoUrl,
  parseIsoId,
} from "@/lib/citations/isoIdentifier";
import type { ArgumentAttestation } from "@/lib/citations/argumentAttestation";

function fixture(overrides: Partial<ArgumentAttestation> = {}): ArgumentAttestation {
  return {
    identifier: "Bx7kQ2mN",
    argumentId: "arg_123",
    permalink: "https://isonomia.app/a/Bx7kQ2mN",
    version: 1,
    contentHash: "sha256:abcdef0123456789",
    immutablePermalink:
      "https://isonomia.app/a/Bx7kQ2mN@abcdef0123456789",
    isoId: "iso:argument:Bx7kQ2mN",
    isoUrl: "https://isonomia.app/iso/argument/Bx7kQ2mN",
    doi: null,
    retrievedAt: "2026-05-01T12:00:00.000Z",
    createdAt: "2024-09-15T08:30:00.000Z",
    updatedAt: "2024-10-01T09:00:00.000Z",
    conclusion: {
      claimId: "claim_1",
      moid: "moid_1",
      text: "Smartphones are causally implicated in the teen mental health crisis.",
    },
    premises: [],
    scheme: null,
    evidence: [],
    structuredCitations: [],
    criticalQuestions: null,
    schemeInstance: null,
    confidence: 0.7,
    dialecticalStatus: {
      incomingAttacks: 0,
      incomingSupports: 0,
      incomingAttackEdges: 0,
      criticalQuestionsRequired: 0,
      criticalQuestionsAnswered: 0,
      criticalQuestionsOpen: 0,
      standingScore: null,
      isTested: false,
      testedness: "untested",
      standingState: "untested-default",
      standingDepth: {
        challengers: 0,
        independentReviewers: 0,
        lastChallengedAt: null,
        lastDefendedAt: null,
        confidence: "thin",
      },
      fitnessBreakdown: {
        total: 0,
        components: {
          cqAnswered: { count: 0, weight: 1, contribution: 0 },
          supportEdges: { count: 0, weight: 0.5, contribution: 0 },
          attackEdges: { count: 0, weight: -0.7, contribution: 0 },
          attackCAs: { count: 0, weight: -1, contribution: 0 },
          evidenceWithProvenance: {
            count: 0,
            weight: 0.25,
            contribution: 0,
          },
        },
        weights: {
          cqAnswered: 1,
          supportEdges: 0.5,
          attackEdges: -0.7,
          attackCAs: -1,
          evidenceWithProvenance: 0.25,
        },
      },
    },
    deliberation: null,
    author: {
      id: "u_1",
      displayName: "Jane Researcher",
      kind: "HUMAN",
      aiProvenance: null,
    },
    canonicalPayload: "{}",
    ...overrides,
  };
}

// ---- iso identifier --------------------------------------------------------

describe("iso identifier", () => {
  it("toIsoId produces a URN of the form iso:<kind>:<shortCode>", () => {
    expect(toIsoId("argument", "Bx7kQ2mN")).toBe("iso:argument:Bx7kQ2mN");
    expect(toIsoId("claim", "abc12345")).toBe("iso:claim:abc12345");
  });

  it("toIsoUrl produces a resolver URL", () => {
    expect(toIsoUrl("argument", "Bx7kQ2mN")).toMatch(
      /\/iso\/argument\/Bx7kQ2mN$/
    );
  });

  it("parseIsoId round-trips a well-formed id", () => {
    const parsed = parseIsoId("iso:argument:Bx7kQ2mN");
    expect(parsed).toEqual({ kind: "argument", shortCode: "Bx7kQ2mN" });
  });

  it("parseIsoId returns null for malformed input", () => {
    expect(parseIsoId(null)).toBeNull();
    expect(parseIsoId("")).toBeNull();
    expect(parseIsoId("doi:10.1234/foo")).toBeNull();
    expect(parseIsoId("iso:foo:bar")).toBeNull(); // unknown kind
    expect(parseIsoId("iso:argument:")).toBeNull(); // empty shortCode
    expect(parseIsoId("iso:argument:bad code")).toBeNull(); // bad chars
  });

  it("toIsoId throws on empty shortCode", () => {
    expect(() => toIsoId("argument", "")).toThrow();
  });
});

// ---- author rendering ------------------------------------------------------

describe("renderAuthorPlain", () => {
  it("HUMAN → displayName", () => {
    expect(renderAuthorPlain(fixture().author)).toBe("Jane Researcher");
  });

  it("HUMAN with no name → 'Anonymous'", () => {
    expect(
      renderAuthorPlain(
        fixture({
          author: { id: null, displayName: null, kind: "HUMAN", aiProvenance: null },
        }).author
      )
    ).toBe("Anonymous");
  });

  it("AI with model → 'Anonymous (AI-assisted via <model>)'", () => {
    expect(
      renderAuthorPlain(
        fixture({
          author: {
            id: null,
            displayName: null,
            kind: "AI",
            aiProvenance: { model: "gpt-4o" },
          },
        }).author
      )
    ).toBe("Anonymous (AI-assisted via gpt-4o)");
  });

  it("HYBRID with name and model → '<name> (AI-assisted via <model>)'", () => {
    expect(
      renderAuthorPlain(
        fixture({
          author: {
            id: "u_1",
            displayName: "Jane Researcher",
            kind: "HYBRID",
            aiProvenance: { model: "claude-opus-4" },
          },
        }).author
      )
    ).toBe("Jane Researcher (AI-assisted via claude-opus-4)");
  });

  it("AI with no model → 'Anonymous (AI-assisted)'", () => {
    expect(
      renderAuthorPlain(
        fixture({
          author: { id: null, displayName: null, kind: "AI", aiProvenance: {} },
        }).author
      )
    ).toBe("Anonymous (AI-assisted)");
  });

  it("null author → 'Anonymous'", () => {
    expect(renderAuthorPlain(null)).toBe("Anonymous");
  });
});

// ---- CSL-JSON --------------------------------------------------------------

describe("toCslJson", () => {
  it("emits the standard CSL fields", () => {
    const csl = toCslJson(fixture());
    expect(csl.id).toBe("iso:argument:Bx7kQ2mN");
    expect(csl.type).toBe("webpage");
    expect(csl.title).toMatch(/teen mental health/);
    expect(csl.author).toEqual([{ literal: "Jane Researcher" }]);
    expect(csl.URL).toBe("https://isonomia.app/a/Bx7kQ2mN@abcdef0123456789");
    expect(csl.publisher).toBe("Isonomia");
    expect(csl["container-title"]).toBe("Isonomia Arguments");
    expect(csl.issued).toEqual({ "date-parts": [[2024, 9, 15]] });
    expect(csl.accessed).toEqual({ "date-parts": [[2026, 5, 1]] });
  });

  it("omits DOI when not minted", () => {
    expect(toCslJson(fixture()).DOI).toBeUndefined();
  });

  it("includes DOI when present", () => {
    expect(toCslJson(fixture({ doi: "10.5072/iso.argument.Bx7kQ2mN" })).DOI).toBe(
      "10.5072/iso.argument.Bx7kQ2mN"
    );
  });

  it("uses 'n.d.' style: no `issued` when createdAt is null", () => {
    expect(toCslJson(fixture({ createdAt: null })).issued).toBeUndefined();
  });
});

// ---- BibTeX ----------------------------------------------------------------

describe("toBibTeX", () => {
  it("emits a well-formed @misc entry", () => {
    const bib = toBibTeX(fixture());
    expect(bib).toMatch(/^@misc\{iso_Bx7kQ2mN,/);
    expect(bib).toMatch(/author = \{Jane Researcher\}/);
    expect(bib).toMatch(/title = \{.*teen mental health.*\}/);
    expect(bib).toMatch(/howpublished = \{\\url\{.*Bx7kQ2mN@abcdef.*\}\}/);
    expect(bib).toMatch(/year = \{2024\}/);
    expect(bib).toMatch(/note = \{iso-id: iso:argument:Bx7kQ2mN; sha256: sha256:abcdef0123456789\}/);
    expect(bib.trim().endsWith("}")).toBe(true);
  });

  it("escapes special characters in the title", () => {
    const bib = toBibTeX(
      fixture({
        conclusion: {
          claimId: "c1",
          moid: null,
          text: "Costs & benefits of #ai (a 100% case)",
        },
      })
    );
    expect(bib).toMatch(/\\&/);
    expect(bib).toMatch(/\\#/);
    expect(bib).toMatch(/\\%/);
  });
});

// ---- RIS -------------------------------------------------------------------

describe("toRis", () => {
  it("emits the expected tag set", () => {
    const ris = toRis(fixture());
    expect(ris).toMatch(/^TY  - ELEC/);
    expect(ris).toMatch(/AU  - Jane Researcher/);
    expect(ris).toMatch(/TI  - .*teen mental health/);
    expect(ris).toMatch(/PY  - 2024/);
    expect(ris).toMatch(/UR  - https:\/\/isonomia.app\/a\/Bx7kQ2mN@abcdef/);
    expect(ris).toMatch(/N1  - iso-id: iso:argument:Bx7kQ2mN/);
    expect(ris.trim().endsWith("ER  -")).toBe(true);
  });
});

// ---- APA / MLA / Chicago ---------------------------------------------------

describe("toApa", () => {
  it("renders the standard web-source pattern", () => {
    expect(toApa(fixture())).toBe(
      "Jane Researcher. (2024). Smartphones are causally implicated in the teen mental health crisis. Isonomia. https://isonomia.app/a/Bx7kQ2mN@abcdef0123456789"
    );
  });

  it("uses 'n.d.' when no createdAt", () => {
    expect(toApa(fixture({ createdAt: null }))).toMatch(/\(n\.d\.\)/);
  });
});

describe("toMla", () => {
  it("renders the standard web-source pattern with curly quotes", () => {
    const out = toMla(fixture());
    expect(out).toMatch(/^Jane Researcher\./);
    expect(out).toMatch(/\u201cSmartphones.*\.\u201d/);
    expect(out).toMatch(/Isonomia Arguments,/);
    expect(out).toMatch(/2024-09-15,/);
    expect(out).toMatch(/Accessed 2026-05-01\.$/);
  });
});

describe("toChicago", () => {
  it("renders the author-date pattern", () => {
    const out = toChicago(fixture());
    expect(out).toMatch(/^Jane Researcher\./);
    expect(out).toMatch(/2024\./);
    expect(out).toMatch(/\u201cSmartphones.*\.\u201d/);
    expect(out.trim().endsWith(".")).toBe(true);
  });
});

// ---- registry --------------------------------------------------------------

describe("renderCitation", () => {
  it("returns a string body with the right Content-Type for each format", () => {
    const att = fixture();
    const csl = renderCitation(att, "csl");
    expect(csl.contentType).toMatch(/csl\+json/);
    expect(() => JSON.parse(csl.body)).not.toThrow();

    expect(renderCitation(att, "bibtex").contentType).toMatch(/bibtex/);
    expect(renderCitation(att, "ris").contentType).toMatch(
      /research-info-systems/
    );
    expect(renderCitation(att, "apa").contentType).toMatch(/text\/plain/);
    expect(renderCitation(att, "mla").contentType).toMatch(/text\/plain/);
    expect(renderCitation(att, "chicago").contentType).toMatch(/text\/plain/);
  });
});

describe("isCitationFormat", () => {
  it("accepts known formats", () => {
    expect(isCitationFormat("csl")).toBe(true);
    expect(isCitationFormat("bibtex")).toBe(true);
    expect(isCitationFormat("apa")).toBe(true);
  });
  it("rejects unknown formats", () => {
    expect(isCitationFormat("html")).toBe(false);
    expect(isCitationFormat("")).toBe(false);
  });
});
