// lib/receipts/verify.ts
import { createPublicKey, verify as nodeVerify, createHmac } from "crypto";
import { canonicalize } from "./jcs";

/**
 * Verify a signed receipt using Ed25519 (preferred) or HMAC fallback.
 *
 * @param obj   the receipt body (without signature)
 * @param signature string like "ed25519:BASE64..." or "hmac-sha256:HEX..."
 * @param publicKeyPem Ed25519 PEM public key (if verifying EdDSA)
 * @param hmacSecret string (if verifying HMAC fallback)
 */
export function verifyReceipt(
  obj: any,
  signature: string,
  publicKeyPem?: string,
  hmacSecret?: string
): boolean {
  const canon = canonicalize(obj);

  if (signature.startsWith("ed25519:")) {
    if (!publicKeyPem) throw new Error("Public key PEM required for Ed25519 verify");
    const sigBytes = Buffer.from(signature.slice("ed25519:".length), "base64");
    const pub = createPublicKey(publicKeyPem);
    return nodeVerify(null, Buffer.from(canon), pub, sigBytes);
  }

  if (signature.startsWith("hmac-sha256:")) {
    if (!hmacSecret) throw new Error("HMAC secret required for hmac-sha256 verify");
    const macHex = createHmac("sha256", hmacSecret).update(canon).digest("hex");
    return signature === `hmac-sha256:${macHex}`;
  }

  throw new Error("Unsupported signature scheme");
}
