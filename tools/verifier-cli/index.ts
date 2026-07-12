#!/usr/bin/env node
// tools/verifier-cli/index.ts
import fs from 'node:fs';
import nacl from 'tweetnacl';

const [,, manifestPath, sigPath] = process.argv;
if (!manifestPath || !sigPath) {
  console.error('Usage: verifier <manifest.json> <export.signature>');
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const sig = Buffer.from(fs.readFileSync(sigPath, 'utf8'), 'base64');
const pub = Buffer.from(process.env.MESH_EXPORT_PUBLIC_KEY!, 'base64');
const ok = nacl.sign.detached.verify(Buffer.from(JSON.stringify(manifest)), sig, pub);
console.log(ok ? 'VALID' : 'INVALID');
process.exit(ok ? 0 : 1);
