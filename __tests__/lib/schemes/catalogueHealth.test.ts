import {
  buildFingerprintPeerIndex,
  computeCatalogueHealth,
  isTestPlaceholderKey,
  type SchemeHealthRow,
} from "@/lib/schemes/catalogueHealth";

const row = (over: Partial<SchemeHealthRow> & { key: string }): SchemeHealthRow => ({
  kind: "argument-scheme",
  clusterTag: "authority_family",
  fingerprint: null,
  ...over,
});

describe("isTestPlaceholderKey", () => {
  test("flags known placeholder keys", () => {
    expect(isTestPlaceholderKey("scheme_test", null)).toBe(true);
    expect(isTestPlaceholderKey("test_scheme", null)).toBe(true);
  });

  test("flags the _test_fixtures cluster regardless of key", () => {
    expect(isTestPlaceholderKey("expert_opinion", "_test_fixtures")).toBe(true);
  });

  test("flags a `test` token at key boundaries", () => {
    expect(isTestPlaceholderKey("test_foo", null)).toBe(true);
    expect(isTestPlaceholderKey("foo_test", null)).toBe(true);
    expect(isTestPlaceholderKey("foo_test_bar", null)).toBe(true);
  });

  test("does not flag a substring `test` inside a real token", () => {
    expect(isTestPlaceholderKey("contest", null)).toBe(false);
    expect(isTestPlaceholderKey("attestation", null)).toBe(false);
  });
});

describe("computeCatalogueHealth", () => {
  test("a healthy argument-pattern row is clean", () => {
    const h = computeCatalogueHealth(row({ key: "expert_opinion", fingerprint: "fp-A" }));
    expect(h).toEqual({
      isArgumentPattern: true,
      isDialogueMeta: false,
      isTestPlaceholder: false,
      duplicateOf: null,
      canonicalKey: "expert_opinion",
      clusterTagMissing: false,
      fingerprintMaterialised: true,
    });
  });

  test("flags dialogue-meta rows", () => {
    const h = computeCatalogueHealth(row({ key: "bare_assertion", kind: "dialogue-meta" }));
    expect(h.isArgumentPattern).toBe(false);
    expect(h.isDialogueMeta).toBe(true);
  });

  test("flags test placeholders", () => {
    const h = computeCatalogueHealth(row({ key: "test_scheme" }));
    expect(h.isTestPlaceholder).toBe(true);
  });

  test("flags missing clusterTag", () => {
    expect(computeCatalogueHealth(row({ key: "x", clusterTag: null })).clusterTagMissing).toBe(true);
    expect(computeCatalogueHealth(row({ key: "x", clusterTag: "  " })).clusterTagMissing).toBe(true);
  });

  test("reports an unmaterialised fingerprint and keeps the row canonical", () => {
    const h = computeCatalogueHealth(row({ key: "legacy", fingerprint: null }));
    expect(h.fingerprintMaterialised).toBe(false);
    expect(h.canonicalKey).toBe("legacy");
    expect(h.duplicateOf).toBe(null);
  });
});

describe("fingerprint-collision duplicate detection", () => {
  test("a unique fingerprint yields no duplicate and self-canonical", () => {
    const cat = [
      row({ key: "alpha", fingerprint: "fp-1" }),
      row({ key: "beta", fingerprint: "fp-2" }),
    ];
    const idx = buildFingerprintPeerIndex(cat);
    const h = computeCatalogueHealth(cat[0], idx);
    expect(h.duplicateOf).toBe(null);
    expect(h.canonicalKey).toBe("alpha");
  });

  test("a colliding pair resolves symmetrically to the lexicographically-smallest canonical", () => {
    const cat = [
      row({ key: "good_consequences", fingerprint: "fp-dup" }),
      row({ key: "positive_consequences", fingerprint: "fp-dup" }),
    ];
    const idx = buildFingerprintPeerIndex(cat);

    const canonical = computeCatalogueHealth(cat[0], idx); // good_consequences
    const dup = computeCatalogueHealth(cat[1], idx); // positive_consequences

    // canonical = "good_consequences" (sorts before "positive_consequences")
    expect(canonical.canonicalKey).toBe("good_consequences");
    expect(canonical.duplicateOf).toBe(null);

    expect(dup.canonicalKey).toBe("good_consequences");
    expect(dup.duplicateOf).toBe("good_consequences");
  });

  test("collision detection is skipped when no peer index is supplied", () => {
    const r = row({ key: "positive_consequences", fingerprint: "fp-dup" });
    const h = computeCatalogueHealth(r);
    expect(h.duplicateOf).toBe(null);
    expect(h.canonicalKey).toBe("positive_consequences");
  });

  test("rows with unmaterialised fingerprints do not participate in collisions", () => {
    const cat = [
      row({ key: "a", fingerprint: null }),
      row({ key: "b", fingerprint: null }),
    ];
    const idx = buildFingerprintPeerIndex(cat);
    expect(idx.size).toBe(0);
    expect(computeCatalogueHealth(cat[0], idx).duplicateOf).toBe(null);
  });
});
