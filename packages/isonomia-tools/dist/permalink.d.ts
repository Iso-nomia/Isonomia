/**
 * Resolve a permalink / shortCode into the canonical shortCode.
 * Accepts:
 *   - "https://isonomia.app/a/Bx7kQ2mN"
 *   - "/a/Bx7kQ2mN"
 *   - "Bx7kQ2mN"
 *   - "Bx7kQ2mN@<hash>"  (immutable form; hash is stripped)
 */
export declare function permalinkToShortCode(input: string): string;
