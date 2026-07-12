// tests/verifyConvergence.test.ts
//
// verify-mode-B v0 — pure convergence clustering invariants.

import {
  clusterConvergence,
  normalizeDoi,
  type ResolvedRef,
} from "@/lib/verify/convergence";

function ref(partial: Partial<ResolvedRef> & { inputUrl: string; canonicalUrl: string }): ResolvedRef {
  return { confidence: "high", ...partial };
}

describe("normalizeDoi", () => {
  test("strips doi.org / dx.doi.org / doi: prefixes and lowercases", () => {
    const want = "10.1234/abc";
    expect(normalizeDoi("https://doi.org/10.1234/ABC")).toBe(want);
    expect(normalizeDoi("http://dx.doi.org/10.1234/abc/")).toBe(want);
    expect(normalizeDoi("doi:10.1234/abc")).toBe(want);
    expect(normalizeDoi("  10.1234/ABC  ")).toBe(want);
  });
});

describe("clusterConvergence", () => {
  test("same DOI via different URLs collapses to one root (the dedup win)", () => {
    const refs = [
      ref({ inputUrl: "https://doi.org/10.1/x", canonicalUrl: "https://doi.org/10.1/x", doi: "10.1/x", domain: "doi.org" }),
      ref({ inputUrl: "https://publisher.com/article", canonicalUrl: "https://publisher.com/article", doi: "10.1/X", domain: "publisher.com" }),
      ref({ inputUrl: "https://pmc.ncbi.nlm.nih.gov/PMC1", canonicalUrl: "https://pmc.ncbi.nlm.nih.gov/PMC1", doi: "10.1/x", domain: "pmc.ncbi.nlm.nih.gov" }),
    ];
    const r = clusterConvergence(refs);
    expect(r.tellings).toBe(3);
    expect(r.roots).toBe(1);
    expect(r.convergent).toBe(true);
    expect(r.clusters[0].members).toHaveLength(3);
    expect(r.headline).toBe("3 tellings → 1 root");
  });

  test("same canonical URL collapses (literally the same page linked twice)", () => {
    const refs = [
      ref({ inputUrl: "https://site.com/a?utm=1", canonicalUrl: "https://site.com/a", domain: "site.com" }),
      ref({ inputUrl: "https://site.com/a?ref=twitter", canonicalUrl: "https://site.com/a", domain: "site.com" }),
    ];
    const r = clusterConvergence(refs);
    expect(r.roots).toBe(1);
    expect(r.clusters[0].rootKind).toBe("url");
  });

  test("distinct articles on the SAME domain do NOT merge (no false convergence)", () => {
    const refs = [
      ref({ inputUrl: "https://nytimes.com/a", canonicalUrl: "https://nytimes.com/a", domain: "nytimes.com" }),
      ref({ inputUrl: "https://nytimes.com/b", canonicalUrl: "https://nytimes.com/b", domain: "nytimes.com" }),
    ];
    const r = clusterConvergence(refs);
    expect(r.roots).toBe(2);
    expect(r.convergent).toBe(false);
    expect(r.headline).toBe("2 tellings → 2 roots");
  });

  test("DOI takes precedence over URL as the root key", () => {
    const refs = [
      ref({ inputUrl: "https://a.com/x", canonicalUrl: "https://a.com/x", doi: "10.5/z", domain: "a.com" }),
      ref({ inputUrl: "https://b.com/y", canonicalUrl: "https://b.com/y", doi: "10.5/z", domain: "b.com" }),
    ];
    const r = clusterConvergence(refs);
    expect(r.roots).toBe(1);
    expect(r.clusters[0].rootKind).toBe("doi");
    expect(r.clusters[0].rootLabel).toBe("10.5/z");
  });

  test("clustering is order-independent", () => {
    const a = ref({ inputUrl: "u1", canonicalUrl: "https://x.com/1", doi: "10.1/a" });
    const b = ref({ inputUrl: "u2", canonicalUrl: "https://x.com/1", doi: "10.1/a" });
    const c = ref({ inputUrl: "u3", canonicalUrl: "https://y.com/2" });
    const forward = clusterConvergence([a, b, c]);
    const reverse = clusterConvergence([c, b, a]);
    expect(forward.headline).toBe(reverse.headline);
    expect(forward.roots).toBe(2);
  });

  test("clusters sort by member count (most-collapsed first)", () => {
    const refs = [
      ref({ inputUrl: "s", canonicalUrl: "https://solo.com/x" }),
      ref({ inputUrl: "a1", canonicalUrl: "https://c.com/a", doi: "10.9/big" }),
      ref({ inputUrl: "a2", canonicalUrl: "https://d.com/a", doi: "10.9/big" }),
      ref({ inputUrl: "a3", canonicalUrl: "https://e.com/a", doi: "10.9/big" }),
    ];
    const r = clusterConvergence(refs);
    expect(r.clusters[0].members).toHaveLength(3);
    expect(r.clusters[0].rootLabel).toBe("10.9/big");
  });

  test("references with no identity land in unresolved", () => {
    const refs = [
      ref({ inputUrl: "x", canonicalUrl: "" }),
      ref({ inputUrl: "https://ok.com/a", canonicalUrl: "https://ok.com/a" }),
    ];
    const r = clusterConvergence(refs);
    expect(r.unresolved).toHaveLength(1);
    expect(r.tellings).toBe(1);
  });

  test("empty input", () => {
    const r = clusterConvergence([]);
    expect(r.headline).toBe("0 tellings → 0 roots");
    expect(r.convergent).toBe(false);
  });
});
