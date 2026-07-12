/**
 * Pure request-shaping for the cluster-7 dialectic tools. Kept separate from
 * server.ts so the mapping can be unit-tested without booting the MCP server
 * (server.ts connects a stdio transport at import time).
 *
 * `buildAttackCaBody` maps the ergonomic `attack_argument` input onto the
 * canonical POST /api/ca body: attackType → legacy AF fields, the target onto
 * the conflicted side (an UNDERMINE naming a premise targets that premise
 * claim), and the attacker onto the conflicting side (an explicit node, else
 * `groundsText` which the server mints into a scheme-free objection claim).
 */
export type AttackType = "REBUT" | "UNDERCUT" | "UNDERMINE";
export interface AttackArgumentArgs {
    deliberationId: string;
    target: {
        type: "argument" | "claim";
        id: string;
    };
    attackType: AttackType;
    attacker?: {
        type: "claim" | "argument";
        id: string;
    };
    groundsText?: string;
    targetPremiseId?: string;
    evidenceClaimIds?: string[];
    sourceUrls?: string[];
    speakAs?: string;
    requestId?: string;
    /** N-1: independence coordinates of the attacking agent/harness. */
    coordinates?: Record<string, unknown>;
}
/**
 * Client-side validation for `attack_argument` (mirrors the CQ-challenge rules):
 * exactly one attacker source, and UNDERMINE must cite evidence. Returns an
 * error message string, or null when the input is valid. Used by the Zod schema
 * (superRefine) so the rule is one tested place, not duplicated in the schema.
 */
export declare function attackArgsValidationError(input: {
    attackType: AttackType;
    attacker?: unknown;
    groundsText?: unknown;
    evidenceClaimIds?: unknown[];
    sourceUrls?: unknown[];
}): string | null;
export declare function buildAttackCaBody(input: AttackArgumentArgs): Record<string, unknown>;
