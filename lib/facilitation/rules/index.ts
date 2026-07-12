/**
 * Facilitation — Rule registry.
 *
 * Order matters only for stable iteration in the driver and tests.
 */

import { unheardSpeakerRule } from "./unheardSpeakerRule";
import { challengeConcentrationRule } from "./challengeConcentrationRule";
import { evidenceGapRule } from "./evidenceGapRule";
import { staleClaimRule } from "./staleClaimRule";
import { cooldownRule } from "./cooldownRule";
import type { RuleDescriptor } from "./types";

export const RULE_REGISTRY: RuleDescriptor[] = [
  unheardSpeakerRule,
  challengeConcentrationRule,
  evidenceGapRule,
  staleClaimRule,
  cooldownRule,
];

export function enabledRules(featureFlags: Record<string, boolean> = {}): RuleDescriptor[] {
  return RULE_REGISTRY.filter((r) => {
    const flag = featureFlags[r.flag];
    return flag === undefined ? r.defaultEnabled : flag;
  });
}

export type { RuleContext, RuleOutput, RuleDescriptor, MetricSnapshot, ClaimSummary, PairwiseTurn } from "./types";
