// lib/crypto/mergeReceipt.ts
import { createHash, createPrivateKey, sign as nodeSign, createHmac } from "crypto";

export function canonicalize(x: any): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(canonicalize).join(",") + "]";
  const keys = Object.keys(x).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalize(x[k])).join(",") + "}";
}

export function sha256Hex(bytes: Buffer | string) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Sign manifest/receipt bytes with Ed25519 if key exists; otherwise HMAC fallback (dev) */
export function signReceiptBytes(bytes: Buffer | string) {
  const b = typeof bytes === "string" ? Buffer.from(bytes) : bytes;
  const edKey = process.env.MERGE_SIGNING_PRIVATE_KEY; // Ed25519 (PKCS#8 PEM)
  if (edKey) {
    const key = createPrivateKey(edKey);
    const sig = nodeSign(null, b, key).toString("base64");
    return { alg: "ed25519-2020", signature: sig };
  }
  const secret = process.env.MERGE_SIGNING_SECRET || "mesh-dev-secret";
  const sig = createHmac("sha256", secret).update(b).digest("hex");
  return { alg: "hmac-sha256", signature: sig };
}
