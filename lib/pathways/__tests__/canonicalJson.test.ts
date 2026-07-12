import { canonicalJsonStringify, CanonicalJsonError } from "../canonicalJson";

describe("canonicalJsonStringify", () => {
  it("sorts object keys recursively", () => {
    const a = canonicalJsonStringify({ b: 1, a: { y: 2, x: 1 } });
    const b = canonicalJsonStringify({ a: { x: 1, y: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"x":1,"y":2},"b":1}');
  });

  it("preserves array order", () => {
    expect(canonicalJsonStringify([3, 1, 2])).toBe("[3,1,2]");
  });

  it("omits undefined object values but keeps nulls", () => {
    expect(canonicalJsonStringify({ a: undefined, b: null, c: 1 })).toBe('{"b":null,"c":1}');
  });

  it("throws on undefined at root", () => {
    expect(() => canonicalJsonStringify(undefined)).toThrow(CanonicalJsonError);
  });

  it("throws on undefined inside arrays (semantically meaningful)", () => {
    expect(() => canonicalJsonStringify([1, undefined, 2])).toThrow(CanonicalJsonError);
  });

  it("serializes Date as ISO 8601 UTC string", () => {
    const d = new Date(Date.UTC(2025, 0, 2, 3, 4, 5));
    expect(canonicalJsonStringify({ t: d })).toBe('{"t":"2025-01-02T03:04:05.000Z"}');
  });

  it("rejects bigint", () => {
    expect(() => canonicalJsonStringify({ n: BigInt(1) })).toThrow(CanonicalJsonError);
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJsonStringify({ n: Number.NaN })).toThrow(CanonicalJsonError);
    expect(() => canonicalJsonStringify({ n: Number.POSITIVE_INFINITY })).toThrow(CanonicalJsonError);
  });

  it("produces compact output (no whitespace)", () => {
    expect(canonicalJsonStringify({ a: 1, b: [2, 3] })).toBe('{"a":1,"b":[2,3]}');
  });

  it("is deterministic across many key permutations", () => {
    const obj1 = { z: 1, a: 2, m: { c: 3, b: [1, 2, 3], a: null } };
    const obj2 = { a: 2, m: { a: null, b: [1, 2, 3], c: 3 }, z: 1 };
    expect(canonicalJsonStringify(obj1)).toBe(canonicalJsonStringify(obj2));
  });
});
