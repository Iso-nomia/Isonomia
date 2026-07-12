// tests/verifyBacking.test.ts
//
// verify-mode-B v1b — pure cores: verdict shaping (the C4 honesty budget) and
// main-text extraction. The LLM-judge and network fetch are runtime-dependent
// and not unit-tested here.

import { shapeVerdict, type BackingAssessment } from "@/lib/verify/backing";
import { extractMainText } from "@/lib/verify/sourceText";

describe("shapeVerdict", () => {
  const A = (relation: BackingAssessment["relation"], confidence: number): BackingAssessment => ({
    relation,
    confidence,
  });

  test("body + entails → backs at full confidence", () => {
    const v = shapeVerdict(A("entails", 0.9), "body");
    expect(v.status).toBe("backs");
    expect(v.confidence).toBe(0.9);
    expect(v.sourceKind).toBe("body");
  });

  test("body + neutral → unrelated (the hollow-citation flag)", () => {
    expect(shapeVerdict(A("neutral", 0.8), "body").status).toBe("unrelated");
  });

  test("body + contradicts → contradicts", () => {
    expect(shapeVerdict(A("contradicts", 0.7), "body").status).toBe("contradicts");
  });

  test("abstract-only caps confidence and flags it", () => {
    const v = shapeVerdict(A("entails", 0.95), "abstract");
    expect(v.status).toBe("backs");
    expect(v.confidence).toBeLessThanOrEqual(0.6);
    expect(v.note).toMatch(/abstract only/i);
  });

  test("source unretrievable → unverifiable, confidence 0, and NOT an accusation", () => {
    const v = shapeVerdict(A("entails", 0.9), "none");
    expect(v.status).toBe("unverifiable");
    expect(v.confidence).toBe(0);
    expect(v.note).toMatch(/not evidence the claim is unsupported/i);
  });

  test("null assessment (judge failed) → unverifiable even with body", () => {
    expect(shapeVerdict(null, "body").status).toBe("unverifiable");
  });

  test("confidence is clamped to [0,1]", () => {
    expect(shapeVerdict(A("entails", 5), "body").confidence).toBe(1);
    expect(shapeVerdict(A("entails", -2), "body").confidence).toBe(0);
    expect(shapeVerdict(A("entails", NaN), "body").confidence).toBe(0);
  });
});

describe("extractMainText", () => {
  test("prefers <article>, strips nav/script/style", () => {
    const html = `
      <html><head><style>.x{color:red}</style></head><body>
        <nav>Home About <a href="/x">Subscribe</a></nav>
        <script>console.log('tracker')</script>
        <article><p>Caffeine delayed sleep onset in adolescents.</p>
          <p>The effect held across two cohorts.</p></article>
        <footer>All rights reserved</footer>
      </body></html>`;
    const text = extractMainText(html);
    expect(text).toContain("Caffeine delayed sleep onset in adolescents.");
    expect(text).toContain("held across two cohorts");
    expect(text).not.toContain("Subscribe");
    expect(text).not.toContain("tracker");
    expect(text).not.toContain("All rights reserved");
  });

  test("falls back to <body> when no <article>/<main>, collapses whitespace", () => {
    const html = `<body><div>alpha</div>\n\n   <div>beta</div></body>`;
    expect(extractMainText(html)).toBe("alpha beta");
  });
});
