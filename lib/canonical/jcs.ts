/**
 * RFC 8785 — JSON Canonicalization Scheme (JCS)
 *
 * Track AI-EPI Pt. 5 §1. Produces a byte-stable serialization of a JSON
 * value so that detached cryptographic signatures over it can be verified
 * across platforms without relying on platform-specific key ordering or
 * whitespace conventions.
 *
 * Conformance notes:
 *   - Object keys are sorted by UTF-16 code-unit order, exactly as
 *     `Array.prototype.sort()` does on JavaScript strings (which is what
 *     RFC 8785 §3.2.3 specifies).
 *   - Numbers are serialized per ECMA-262 7.1.12.1; `Number.prototype
 *     .toString()` produces the right form for normal finite values.
 *     Non-finite numbers (`NaN`, `±Infinity`) are rejected per §3.2.2.4.
 *   - `BigInt` is rejected (JSON has no native bigint; encoders disagree).
 *   - `undefined` values are rejected when encountered as an array element
 *     or top-level value, and skipped when encountered as an object value
 *     (matching `JSON.stringify` semantics for the latter).
 *   - Strings are serialized with the JCS-mandated subset of escapes:
 *     U+0008..U+000D get the short escapes (\b \t \n \f \r); other control
 *     characters get \u00XX; `"` and `\` get backslash-escaped; everything
 *     else is emitted verbatim (UTF-8 by way of being a JS string).
 */

const MAX_RECURSION = 200;

function quoteString(s: string): string {
  // Per RFC 8785 §3.2.2.2, only the seven mandated escapes are produced;
  // other characters in the C0 range are emitted as `\u00XX` (lowercase
  // hex digits per §3.2.2.2 wording).
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
    // BMP characters and surrogate halves pass through; surrogate pairs are
    // valid UTF-16 in the source string and JCS preserves them verbatim.
    out += s[i];
  }
  return out + '"';
}

function serializeNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new TypeError(`JCS: non-finite number cannot be canonicalized (${n})`);
  }
  // `Number.prototype.toString()` already produces the ECMA-262 7.1.12.1
  // shortest-round-trip representation (scientific notation for very
  // large/small numbers, no trailing `.0`, etc.). RFC 8785 §3.2.2.3
  // delegates to exactly that algorithm.
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
      // Arrays preserve element order and emit `null` for `undefined`
      // members (matching `JSON.stringify`).
      if (item === undefined) {
        parts.push("null");
      } else {
        parts.push(serialize(item, depth + 1));
      }
    }
    return "[" + parts.join(",") + "]";
  }

  // Plain object. Reject non-plain objects (Date, Map, Set, class instances)
  // because their serialization is ambiguous — callers should pre-convert
  // (e.g. `date.toISOString()`).
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError(
      `JCS: only plain objects are accepted; got ${proto?.constructor?.name ?? "non-plain"}`,
    );
  }

  const obj = value as Record<string, unknown>;
  // Per RFC 8785 §3.2.3: sort keys by UTF-16 code unit order. JavaScript's
  // default `Array.sort()` on strings does exactly this.
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = obj[k];
    // Match `JSON.stringify` semantics: skip undefined-valued object members.
    if (v === undefined) continue;
    parts.push(quoteString(k) + ":" + serialize(v, depth + 1));
  }
  return "{" + parts.join(",") + "}";
}

/**
 * Canonicalize a JSON-compatible value per RFC 8785.
 *
 * Throws `TypeError` for non-finite numbers, `BigInt`, `undefined` (as a
 * top-level or array value), or non-plain objects. Throws `RangeError` if
 * the input exceeds the configured recursion depth.
 */
export function canonicalize(value: unknown): string {
  return serialize(value, 0);
}

/**
 * Convenience: canonicalize and return a `Uint8Array` of UTF-8 bytes
 * suitable for hashing or signing.
 */
export function canonicalizeToBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}
