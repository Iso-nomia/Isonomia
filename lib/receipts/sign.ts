// lib/receipts/sign.ts
import { createHmac, createPrivateKey, sign as nodeSign, createSign } from "crypto";
import { canonicalize } from "./jcs";

const KEY_ID = process.env.MESH_SIGNING_KEY_ID || "mesh";
const PRIVATE_PEM = process.env.MESH_SIGNING_PRIVATE_KEY_PEM || "";
const HMAC_SECRET = process.env.MERGE_SIGNING_SECRET || "mesh-dev-secret";

/**
 * Sign a receipt-like object. Autodetects key type:
 *  - Ed25519/Ed448  => nodeSign(null, ... key)
 *  - RSA/ECDSA      => createSign("sha256")
 *  - Fallback       => HMAC-SHA256 hex
 */
export function signReceipt(obj: any): { signature: string; keyId: string; alg: string } {
  const canon = canonicalize(obj);
  if (PRIVATE_PEM) {
    try {
      const key = createPrivateKey(PRIVATE_PEM);
      // @ts-ignore - Node's KeyObject exposes asymmetricKeyType
      const type: string | undefined = (key as any).asymmetricKeyType;

      if (type === "ed25519" || type === "ed448") {
        const sig = nodeSign(null, Buffer.from(canon), key).toString("base64");
        const alg = type; // "ed25519" or "ed448"
        return { signature: `${alg}:${sig}`, keyId: KEY_ID, alg };
      }

      if (type === "rsa" || type === "rsa-pss" || type === "ec") {
        // RSA/ECDSA: hash canon with SHA-256
        const signer = createSign("sha256");
        signer.update(canon);
        signer.end();
        const sig = signer.sign(key).toString("base64");
        const alg = type === "ec" ? "ecdsa-sha256" : "rsa-sha256";
        return { signature: `${alg}:${sig}`, keyId: KEY_ID, alg };
      }

      // Unknown/asymmetric unsupported → fallback to HMAC below
      console.warn(`[signReceipt] unsupported key type "${type}", falling back to HMAC`);
    } catch (e) {
      console.warn("[signReceipt] PEM decode/sign failed, falling back to HMAC:", (e as Error).message);
    }
  }

  // HMAC fallback (dev-safe)
  const mac = createHmac("sha256", HMAC_SECRET).update(canon).digest("hex");
  return { signature: `hmac-sha256:${mac}`, keyId: "hmac", alg: "hmac-sha256" };
}
