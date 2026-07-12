#!/usr/bin/env tsx
/**
 * Generate an Ed25519 keypair and emit:
 *  - Private key PEM (PKCS#8)
 *  - Public key PEM (SubjectPublicKeyInfo)
 *  - A ready-to-paste .env.local block
 *
 * Usage:
 *   pnpm tsx scripts/gen-ed25519.ts
 * or
 *   npx tsx scripts/gen-ed25519.ts
 */
import { generateKeyPairSync } from "crypto";

function main() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  const privOneLine = privateKey.replace(/\r?\n/g, "\\n");
  const pubOneLine = publicKey.replace(/\r?\n/g, "\\n");

  // Display PEMs (nice to save to files if you want)
  console.log("\n=== Ed25519 PRIVATE (PKCS#8) ===\n");
  console.log(privateKey);
  console.log("=== Ed25519 PUBLIC (SPKI) ===\n");
  console.log(publicKey);

  // Ready-to-paste .env.local
  console.log("\n=== .env.local snippet ===\n");
  console.log(`MESH_SIGNING_PRIVATE_KEY_PEM="${privOneLine}"`);
  console.log(`MESH_SIGNING_PUBLIC_KEY_PEM="${pubOneLine}"`);
  console.log(`MESH_SIGNING_KEY_ID="mesh-ed25519-main"`);
  console.log(`# (optional) HMAC fallback for dev; leave unset in prod`);
  console.log(`# MERGE_SIGNING_SECRET="your-dev-only-secret"\n`);
}

main();
