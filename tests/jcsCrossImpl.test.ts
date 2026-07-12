// tests/jcsCrossImpl.test.ts
//
// Drift guard for verify-mode-A. The Chrome extension verifies `?signed=1`
// attestations by re-canonicalizing the signed subset with a VENDORED copy of
// the RFC 8785 JCS canonicalizer (`extensions/chrome/src/shared/jcs.ts`). If that
// copy ever diverges by a single byte from the server's `lib/canonical/jcs.ts`,
// every signature silently fails to verify in the wild. This test imports BOTH
// and asserts byte-identical output on a fixture battery, plus pins a few exact
// outputs so a coordinated drift of both copies is also caught.

import { canonicalize as serverCanon } from "@/lib/canonical/jcs";
import { canonicalize as extCanon } from "../extensions/chrome/src/shared/jcs";

const FIXTURES: Array<{ name: string; value: unknown }> = [
  { name: "empty object", value: {} },
  { name: "empty array", value: [] },
  { name: "key ordering", value: { b: 1, a: 2, c: 3 } },
  { name: "nested key ordering", value: { z: { y: 1, x: 2 }, a: [3, { d: 4, c: 5 }] } },
  { name: "primitives", value: { n: null, t: true, f: false, zero: 0, neg: -12.5 } },
  { name: "number forms", value: { big: 1e21, small: 1e-7, int: 42, frac: 0.1 } },
  { name: "string escapes", value: { s: 'tab\tnewline\nquote"backslash\\bell' } },
  { name: "unicode passthrough", value: { emoji: "café — 汉字 🌍" } },
  { name: "array with holes-as-null semantics", value: [1, null, "x"] },
  {
    name: "attestation-shaped subset",
    value: {
      contentHash: "sha256:" + "a".repeat(64),
      version: 3,
      conclusion: { claimId: "c1", moid: "m1", text: "Therefore X." },
      premises: [{ claimId: "p1", moid: "mp1", text: "Because Y.", isImplicit: false }],
      dialecticalStatus: { incomingAttacks: 0, standingScore: 0.6, testedness: "lightly_tested" },
      doi: null,
    },
  },
];

describe("JCS cross-impl parity (server ↔ extension vendored copy)", () => {
  for (const { name, value } of FIXTURES) {
    test(`byte-identical: ${name}`, () => {
      expect(extCanon(value)).toBe(serverCanon(value));
    });
  }

  test("both produce the RFC-8785 canonical key ordering (pins exact output)", () => {
    const expected = '{"a":2,"b":1,"c":3}';
    expect(serverCanon({ b: 1, a: 2, c: 3 })).toBe(expected);
    expect(extCanon({ b: 1, a: 2, c: 3 })).toBe(expected);
  });

  test("both apply the JCS string escape set identically (pins exact output)", () => {
    const value = { s: 'a\tb\nc"d\\e' };
    const expected = '{"s":"a\\tb\\nc\\"d\\\\e"}';
    expect(serverCanon(value)).toBe(expected);
    expect(extCanon(value)).toBe(expected);
  });

  test("both reject non-finite numbers", () => {
    expect(() => serverCanon({ x: Infinity })).toThrow();
    expect(() => extCanon({ x: Infinity })).toThrow();
  });
});
