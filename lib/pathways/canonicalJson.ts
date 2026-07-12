/**
 * Pathways — Canonical JSON serializer
 *
 * Deterministic JSON serialization for hashing and snapshotting. Used by:
 *   - `snapshotSerializer.ts` for `RecommendationPacketItem.snapshotHash`.
 *   - `hashChain.ts` for `PathwayEvent.hashChainSelf`.
 *
 * Properties:
 *   - Object keys are sorted recursively (lexicographic on UTF-16 code units, matching V8 default).
 *   - Arrays preserve order (semantically meaningful for packet items and citations).
 *   - `undefined` values are omitted (matches `JSON.stringify` default).
 *   - `Date` instances serialize to ISO 8601 strings (UTC).
 *   - `bigint` is rejected; callers must convert beforehand.
 *   - No whitespace; compact form.
 *
 * Status: A0 scaffold. Pure module, no external dependencies.
 */

export class CanonicalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalJsonError";
  }
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function normalize(value: unknown, path: string): JsonValue {
  if (value === null) return null;
  if (value === undefined) {
    throw new CanonicalJsonError(`undefined value at ${path}`);
  }

  const t = typeof value;

  if (t === "string" || t === "boolean") return value as JsonPrimitive;

  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new CanonicalJsonError(`non-finite number at ${path}`);
    }
    return value as number;
  }

  if (t === "bigint") {
    throw new CanonicalJsonError(`bigint not allowed at ${path}; convert to string or number`);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item, idx) => normalize(item, `${path}[${idx}]`));
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: { [key: string]: JsonValue } = {};
    for (const key of keys) {
      const v = obj[key];
      if (v === undefined) continue;
      out[key] = normalize(v, `${path}.${key}`);
    }
    return out;
  }

  throw new CanonicalJsonError(`unsupported value type ${t} at ${path}`);
}

/**
 * Serialize a value to deterministic, compact JSON suitable for hashing.
 * Throws `CanonicalJsonError` on unsupported inputs.
 */
export function canonicalJsonStringify(value: unknown): string {
  const normalized = normalize(value, "$");
  return JSON.stringify(normalized);
}
