// lib/bigintjson.ts
export function jsonSafe<T>(obj: T): T {
    return JSON.parse(
      JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? Number(v) : v))
    );
  }

  // lib/bigintjson.ts
export function jsonSafeStr<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) =>
    typeof v === "bigint" ? v.toString()
    : v instanceof Date   ? v.toISOString()
    : v
  ));
}