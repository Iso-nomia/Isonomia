// server/trust/sign.ts
import nacl from "tweetnacl";
export function signDetached(payload: Buffer) {
  const pkBase64 = process.env.MESH_EXPORT_PRIVATE_KEY_BASE64!;
  const secretKey = Buffer.from(pkBase64, "base64");
  const sig = nacl.sign.detached(payload, new Uint8Array(secretKey));
  return Buffer.from(sig);
}
export function verifyDetached(payload: Buffer, sig: Buffer, pubKeyBase64: string) {
  const publicKey = Buffer.from(pubKeyBase64, "base64");
  return nacl.sign.detached.verify(payload, new Uint8Array(sig), new Uint8Array(publicKey));
}
