import {
  resolveSchemeForWrite,
  verifyAgainstFingerprintPeers,
} from "@/lib/schemes/writeGate";

// Minimal scheme row shape the gate reads.
type Row = {
  id: string;
  key: string;
  name: string;
  kind: string;
  clusterTag: string | null;
  fingerprint: string | null;
  epistemicMode: string;
};

const SCHEME_ROW = (over: Partial<Row> & { key: string }): Row => ({
  id: `id_${over.key}`,
  name: over.key ?? "",
  kind: "argument-scheme",
  clusterTag: "expert_family",
  fingerprint: null,
  epistemicMode: "FACTUAL",
  ...over,
});

/** Build a fake `tx` whose argumentScheme queries read from an in-memory catalogue. */
function fakeTx(rows: Row[]) {
  return {
    argumentScheme: {
      findMany: async ({ where, include }: any = {}) => {
        let out = rows;
        if (where?.kind) out = out.filter((r) => r.kind === where.kind);
        if (where?.fingerprint !== undefined) {
          out = out.filter((r) => r.fingerprint === where.fingerprint);
        }
        if (where?.id?.not) out = out.filter((r) => r.id !== where.id.not);
        return out.map((r) => (include?.cqs ? { ...r, cqs: [] } : r));
      },
      findUnique: async ({ where, include }: any) => {
        const r = rows.find((x) => (where.key ? x.key === where.key : x.id === where.id));
        if (!r) return null;
        return include?.cqs ? { ...r, cqs: [] } : r;
      },
    },
  } as any;
}

describe("resolveSchemeForWrite (B.1 health gate)", () => {
  test("unknown key → SCHEME_UNKNOWN", async () => {
    const tx = fakeTx([SCHEME_ROW({ key: "expert_opinion" })]);
    const res = await resolveSchemeForWrite("does_not_exist", tx);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("SCHEME_UNKNOWN");
  });

  test("dialogue-meta key → SCHEME_NOT_ARGUMENT_PATTERN", async () => {
    const tx = fakeTx([
      SCHEME_ROW({ key: "bare_assertion", kind: "dialogue-meta" }),
    ]);
    const res = await resolveSchemeForWrite("bare_assertion", tx);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("SCHEME_NOT_ARGUMENT_PATTERN");
      expect(res.requestedKey).toBe("bare_assertion");
    }
  });

  test("test-placeholder key → SCHEME_NOT_ARGUMENT_PATTERN", async () => {
    const tx = fakeTx([SCHEME_ROW({ key: "test_scheme" })]);
    const res = await resolveSchemeForWrite("test_scheme", tx);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("SCHEME_NOT_ARGUMENT_PATTERN");
  });

  test("healthy key resolves with no canonicalization", async () => {
    const tx = fakeTx([
      SCHEME_ROW({ key: "expert_opinion", epistemicMode: "FACTUAL" }),
    ]);
    const res = await resolveSchemeForWrite("expert_opinion", tx);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.scheme.key).toBe("expert_opinion");
      expect(res.scheme.epistemicMode).toBe("FACTUAL");
      expect(res.canonicalizedFrom).toBe(null);
    }
  });

  test("folksonomy duplicate auto-redirects to canonical sibling", async () => {
    // Two argument-patterns sharing a fingerprint; canonical = lexicographically
    // smallest key ("good_consequences").
    const tx = fakeTx([
      SCHEME_ROW({ key: "good_consequences", fingerprint: "fp-dup" }),
      SCHEME_ROW({ key: "positive_consequences", fingerprint: "fp-dup" }),
    ]);
    const res = await resolveSchemeForWrite("positive_consequences", tx);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.scheme.key).toBe("good_consequences");
      expect(res.canonicalizedFrom).toBe("positive_consequences");
    }
  });

  test("the canonical key itself is not flagged as a redirect", async () => {
    const tx = fakeTx([
      SCHEME_ROW({ key: "good_consequences", fingerprint: "fp-dup" }),
      SCHEME_ROW({ key: "positive_consequences", fingerprint: "fp-dup" }),
    ]);
    const res = await resolveSchemeForWrite("good_consequences", tx);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.scheme.key).toBe("good_consequences");
      expect(res.canonicalizedFrom).toBe(null);
    }
  });
});

describe("verifyAgainstFingerprintPeers (B.1 radar)", () => {
  test("null fingerprint → skipped", async () => {
    const tx = fakeTx([SCHEME_ROW({ key: "expert_opinion" })]);
    const v = await verifyAgainstFingerprintPeers("id_expert_opinion", null, tx);
    expect(v.kind).toBe("skipped");
    expect(v.againstSchemeKey).toBe(null);
  });

  test("no same-fingerprint peer → skipped (Phase 4d baseline)", async () => {
    const tx = fakeTx([
      SCHEME_ROW({ key: "expert_opinion", fingerprint: "fp-unique" }),
    ]);
    const v = await verifyAgainstFingerprintPeers(
      "id_expert_opinion",
      "fp-unique",
      tx,
    );
    expect(v.kind).toBe("skipped");
  });
});
