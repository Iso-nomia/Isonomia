import crypto from 'crypto';

/** Very small canonicalization: trim & collapse whitespace, NFC. */
export function canonicalizeClaimText(text: string) {
  const nfc = text.normalize('NFC');
  const collapsed = nfc.replace(/\s+/g, ' ').trim();
  return JSON.stringify({ text: collapsed });
}

export function mintClaimMoid(text: string) {
  const canonical = canonicalizeClaimText(text);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}
