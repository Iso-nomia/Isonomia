// tests/verifyLineage.test.ts
//
// verify-mode-B v2 — pure cores of shared-root detection: upstream extraction
// from HTML and union-find clustering by shared upstream. The network fetch is
// runtime-dependent and not unit-tested here.

import {
  extractUpstreamsFromHtml,
  clusterByUpstream,
  type SourceWithUpstream,
  type UpstreamRef,
} from "@/lib/verify/lineage";

describe("extractUpstreamsFromHtml", () => {
  test("extracts a cited DOI from text and hrefs", () => {
    const html = `<body><p>See the study at https://doi.org/10.1371/journal.pone.0313362 for details.</p>
      <a href="https://doi.org/10.1371/journal.pone.0313362">paper</a></body>`;
    const refs = extractUpstreamsFromHtml(html);
    expect(refs).toContainEqual<UpstreamRef>({
      kind: "cited-doi",
      key: "doi:10.1371/journal.pone.0313362",
      label: "10.1371/journal.pone.0313362",
    });
    // deduped to a single ref despite appearing twice
    expect(refs.filter((r) => r.kind === "cited-doi")).toHaveLength(1);
  });

  test("detects a wire byline", () => {
    const refs = extractUpstreamsFromHtml(`<body><p>LONDON (Reuters) - Scientists reported a finding.</p></body>`);
    expect(refs).toContainEqual<UpstreamRef>({ kind: "wire", key: "wire:reuters", label: "Reuters" });
  });

  test("detects a press-release host link", () => {
    const refs = extractUpstreamsFromHtml(`<body><a href="https://www.eurekalert.org/news-releases/12345">release</a></body>`);
    expect(refs.some((r) => r.kind === "press-release" && r.key.startsWith("pr:eurekalert.org"))).toBe(true);
  });

  test("excludeDoi drops the source's own DOI", () => {
    const html = `<body><p>Compare 10.1234/self with 10.5678/other findings.</p></body>`;
    const refs = extractUpstreamsFromHtml(html, { excludeDoi: "https://doi.org/10.1234/self" });
    const dois = refs.filter((r) => r.kind === "cited-doi").map((r) => r.label);
    expect(dois).toContain("10.5678/other");
    expect(dois).not.toContain("10.1234/self");
  });
});

describe("clusterByUpstream", () => {
  const src = (id: string, upstreams: UpstreamRef[]): SourceWithUpstream => ({ id, url: id, upstreams });
  const doi = (d: string): UpstreamRef => ({ kind: "cited-doi", key: `doi:${d}`, label: d });
  const wire = (k: string, l: string): UpstreamRef => ({ kind: "wire", key: `wire:${k}`, label: l });

  test("two articles citing the same study collapse into one lineage", () => {
    const r = clusterByUpstream([
      src("https://outlet-a.com/story", [doi("10.9/study")]),
      src("https://outlet-b.com/piece", [doi("10.9/study")]),
    ]);
    expect(r.lineages).toBe(1);
    expect(r.convergent).toHaveLength(1);
    expect(r.convergent[0].members).toHaveLength(2);
    expect(r.convergent[0].sharedUpstreams.map((u) => u.label)).toContain("10.9/study");
    expect(r.headline).toBe("2 sources → 1 lineage");
  });

  test("sources with disjoint upstreams stay independent", () => {
    const r = clusterByUpstream([
      src("a", [doi("10.1/x")]),
      src("b", [doi("10.2/y")]),
    ]);
    expect(r.lineages).toBe(2);
    expect(r.convergent).toHaveLength(0);
    expect(r.headline).toBe("2 sources → 2 lineages");
  });

  test("transitive convergence via different shared upstreams (A~B by DOI, B~C by wire)", () => {
    const r = clusterByUpstream([
      src("a", [doi("10.5/z")]),
      src("b", [doi("10.5/z"), wire("reuters", "Reuters")]),
      src("c", [wire("reuters", "Reuters")]),
    ]);
    expect(r.lineages).toBe(1);
    expect(r.convergent[0].members).toHaveLength(3);
    // both the DOI and the wire are shared roots within the component
    const labels = r.convergent[0].sharedUpstreams.map((u) => u.label).sort();
    expect(labels).toEqual(["10.5/z", "Reuters"]);
  });

  test("counts sources with no upstream signal and keeps them singleton", () => {
    const r = clusterByUpstream([
      src("a", [doi("10.1/x")]),
      src("b", [doi("10.1/x")]),
      src("c", []),
    ]);
    expect(r.noUpstream).toBe(1);
    expect(r.lineages).toBe(2); // {a,b} + {c}
    expect(r.convergent).toHaveLength(1);
  });

  test("clustering is order-independent", () => {
    const build = (arr: SourceWithUpstream[]) => clusterByUpstream(arr).headline;
    const a = src("a", [doi("10.1/x")]);
    const b = src("b", [doi("10.1/x")]);
    const c = src("c", [doi("10.2/y")]);
    expect(build([a, b, c])).toBe(build([c, b, a]));
  });
});
