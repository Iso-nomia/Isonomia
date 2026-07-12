// ─────────────────────────────────────────────────────────────────────────────
// RFC 8785 — JSON Canonicalization Scheme (JCS), browser copy.
//
// ⚠️ VENDORED — this MUST stay byte-identical to `lib/canonical/jcs.ts` in the
// main repo. The server signs `?signed=1` attestations over `canonicalize(...)`
// output; if this copy diverges by a single byte, every signature fails to
// verify here. Pure (no Node `crypto`), so it runs unchanged in the extension.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RECURSION = 200;

function quoteString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    switch (c) {
      case 0x08: out += "\\b"; continue;
      case 0x09: out += "\\t"; continue;
      case 0x0a: out += "\\n"; continue;
      case 0x0c: out += "\\f"; continue;
      case 0x0d: out += "\\r"; continue;
      case 0x22: out += '\\"'; continue;
      case 0x5c: out += "\\\\"; continue;
    }
    if (c < 0x20) {
      out += "\\u" + c.toString(16).padStart(4, "0");
      continue;
    }
    out += s[i];
  }
  return out + '"';
}

function serializeNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new TypeError(`JCS: non-finite number cannot be canonicalized (${n})`);
  }
  return n === 0 ? "0" : n.toString();
}

function serialize(value: unknown, depth: number): string {
  if (depth > MAX_RECURSION) {
    throw new RangeError("JCS: input exceeds maximum recursion depth");
  }

  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return serializeNumber(value);
    case "string":
      return quoteString(value);
    case "bigint":
      throw new TypeError("JCS: BigInt is not representable in JSON");
    case "undefined":
      throw new TypeError("JCS: undefined is not representable in JSON");
    case "function":
    case "symbol":
      throw new TypeError(`JCS: ${typeof value} is not representable in JSON`);
  }

  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const item of value) {
      if (item === undefined) {
        parts.push("null");
      } else {
        parts.push(serialize(item, depth + 1));
      }
    }
    return "[" + parts.join(",") + "]";
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError(
      `JCS: only plain objects are accepted; got ${proto?.constructor?.name ?? "non-plain"}`,
    );
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined) continue;
    parts.push(quoteString(k) + ":" + serialize(v, depth + 1));
  }
  return "{" + parts.join(",") + "}";
}

/** Canonicalize a JSON-compatible value per RFC 8785. */
export function canonicalize(value: unknown): string {
  return serialize(value, 0);
}
