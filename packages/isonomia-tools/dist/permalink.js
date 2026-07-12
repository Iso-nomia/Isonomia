/**
 * Resolve a permalink / shortCode into the canonical shortCode.
 * Accepts:
 *   - "https://isonomia.app/a/Bx7kQ2mN"
 *   - "/a/Bx7kQ2mN"
 *   - "Bx7kQ2mN"
 *   - "Bx7kQ2mN@<hash>"  (immutable form; hash is stripped)
 */
export function permalinkToShortCode(input) {
    let s = input.trim();
    // Strip URL prefix
    const m = s.match(/\/a\/([^/?#@]+)/);
    if (m)
        s = m[1];
    // Strip immutable @hash suffix
    const at = s.indexOf("@");
    if (at !== -1)
        s = s.slice(0, at);
    return s;
}
