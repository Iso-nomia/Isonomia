// lib/crypto/encryption.ts
// server-only AES-256-GCM with a tiny versioned envelope
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENV_KEY = process.env.CONNECTIONS_KEY_B64 || process.env.ENCRYPTION_KEY_B64;
function getKey(): Buffer {
  if (!ENV_KEY) throw new Error("CONNECTIONS_KEY_B64 missing");
  const key = Buffer.from(ENV_KEY, "base64");
  if (key.length !== 32) throw new Error("CONNECTIONS_KEY_B64 must be 32 bytes base64");
  return key;
}

// [ver=1][iv:12][tag:16][ciphertext...]
export function encryptStringToBytes(plain: string): Buffer {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([1]), iv, tag, ciphertext]);
}

export function decryptBytesToString(buf: Buffer): string {
  const key = getKey();
  const ver = buf.readUInt8(0);
  if (ver !== 1) throw new Error(`Unsupported cipher version: ${ver}`);
  const iv = buf.subarray(1, 13);
  const tag = buf.subarray(13, 29);
  const ciphertext = buf.subarray(29);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

export function encryptJsonToBytes(obj: unknown): Buffer {
  return encryptStringToBytes(JSON.stringify(obj ?? null));
}
export function decryptBytesToJson<T = any>(buf?: Buffer | null): T | null {
  if (!buf) return null;
  return JSON.parse(decryptBytesToString(buf));
}
