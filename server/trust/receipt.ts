// server/trust/receipt.ts
//
// LEGACY signer for the decentralise/sovereignty receipt path. Uses
// `JSON.stringify` for the signed bytes, which is implementation-defined
// for key ordering and therefore UNSAFE for cross-system verification.
//
// New attestation-signing work — Track AI-EPI Pt. 5 (D.1) — should use
// `server/trust/attestationSigner.ts`, which signs over JCS-canonicalized
// (RFC 8785) bytes and is verifiable by any RFC-conformant JCS + Ed25519
// implementation. This file is preserved as-is for back-compat with the
// existing room/decentralise receipt consumers in `server/jobs/`.
import nacl from 'tweetnacl';

export function createReceipt(payload: Record<string, any>) {
  const secret = Buffer.from(process.env.MESH_EXPORT_SECRET_KEY!, 'base64');
  const msg = Buffer.from(JSON.stringify(payload));
  const sig = nacl.sign.detached(msg, secret);
  return { payload, signature: Buffer.from(sig).toString('base64'), alg: 'Ed25519', keyId: 'mesh-export-key-1' };
}

export function verifyReceipt(receipt: { payload: any; signature: string }) {
  const pub = Buffer.from(process.env.MESH_EXPORT_PUBLIC_KEY!, 'base64');
  const ok = nacl.sign.detached.verify(Buffer.from(JSON.stringify(receipt.payload)), Buffer.from(receipt.signature, 'base64'), pub);
  return ok;
}
