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

const ATTACK_MAP: Record<AttackType, { legacyAttackType: string; legacyTargetScope: string }> = {
  REBUT: { legacyAttackType: "REBUTS", legacyTargetScope: "conclusion" },
  UNDERCUT: { legacyAttackType: "UNDERCUTS", legacyTargetScope: "inference" },
  UNDERMINE: { legacyAttackType: "UNDERMINES", legacyTargetScope: "premise" },
};

export interface AttackArgumentArgs {
  deliberationId: string;
  target: { type: "argument" | "claim"; id: string };
  attackType: AttackType;
  attacker?: { type: "claim" | "argument"; id: string };
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
export function attackArgsValidationError(input: {
  attackType: AttackType;
  attacker?: unknown;
  groundsText?: unknown;
  evidenceClaimIds?: unknown[];
  sourceUrls?: unknown[];
}): string | null {
  if (!input.attacker && !input.groundsText) {
    return "Provide either `attacker` (an existing node) or `groundsText` (to mint an objection claim).";
  }
  const evidenceCount =
    (input.evidenceClaimIds?.length ?? 0) + (input.sourceUrls?.length ?? 0);
  if (input.attackType === "UNDERMINE" && evidenceCount === 0) {
    return "UNDERMINE requires at least one evidenceClaimIds or sourceUrls entry.";
  }
  return null;
}

export function buildAttackCaBody(input: AttackArgumentArgs): Record<string, unknown> {
  const map = ATTACK_MAP[input.attackType];

  // Conflicted (target) side.
  const conflicted =
    input.attackType === "UNDERMINE" && input.targetPremiseId
      ? { conflictedClaimId: input.targetPremiseId }
      : input.target.type === "argument"
        ? { conflictedArgumentId: input.target.id }
        : { conflictedClaimId: input.target.id };

  // Conflicting (attacker) side: an explicit node, else groundsText → mint.
  const conflicting = input.attacker
    ? input.attacker.type === "argument"
      ? { conflictingArgumentId: input.attacker.id }
      : { conflictingClaimId: input.attacker.id }
    : {};

  const evidenceClaimIds = input.evidenceClaimIds ?? [];
  const sourceUrls = input.sourceUrls ?? [];

  return {
    deliberationId: input.deliberationId,
    ...map,
    ...conflicted,
    ...conflicting,
    ...(input.attacker ? {} : { groundsText: input.groundsText }),
    metaJson: {
      source: "mcp-attack",
      ...(evidenceClaimIds.length ? { evidenceClaimIds } : {}),
      ...(sourceUrls.length ? { sourceUrls } : {}),
    },
    ...(input.speakAs ? { speakAs: input.speakAs } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.coordinates ? { coordinates: input.coordinates } : {}),
  };
}
