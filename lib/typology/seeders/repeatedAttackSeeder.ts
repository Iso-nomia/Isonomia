/**
 * Typology — Repeated attack seeder
 *
 * NOTE: The full implementation requires a "repeated attack" detector that
 * inspects ArgumentEdge / ClaimAttack rows. The detector lives outside the
 * facilitation event chain, so this seeder is invoked directly by a
 * (future) cron / detector module rather than by the event bus.
 *
 * For B1 we ship the descriptor and `synthesize` helper; the cron wiring
 * lands in B2.
 */

import {
  DisagreementAxisKey,
  DisagreementTagSeedSource,
  DisagreementTagTargetType,
} from "../types";
import type { Priority, SeederDescriptor, SeederOutput } from "./types";

export const repeatedAttackSeeder: SeederDescriptor & {
  kind: "detector";
  synthesize: (input: RepeatedAttackInput) => SeederOutput;
} = {
  name: "repeatedAttackSeeder",
  version: 1,
  defaultEnabled: true,
  flag: "ff_typology_seeder_repeated_attack",
  kind: "detector",
  synthesize(input: RepeatedAttackInput): SeederOutput {
    const priority: Priority = input.distinctAuthorCount >= 4 ? 3 : 2;
    return {
      targetType: input.targetType,
      targetId: input.targetId,
      suggestedAxisKey: input.axisHint ?? DisagreementAxisKey.EMPIRICAL,
      rationaleText:
        input.rationaleText ??
        `${input.targetType} ${input.targetId} attacked by ${input.distinctAuthorCount} distinct authors with differing evidence.`,
      priority,
      seedSource: DisagreementTagSeedSource.REPEATED_ATTACK_SEED,
      seedReferenceJson: {
        detectorRunId: input.detectorRunId,
        attackEdgeIds: input.attackEdgeIds,
        distinctAuthorCount: input.distinctAuthorCount,
      },
    };
  },
};

export interface RepeatedAttackInput {
  targetType: DisagreementTagTargetType;
  targetId: string;
  detectorRunId: string;
  attackEdgeIds: string[];
  distinctAuthorCount: number;
  axisHint?: DisagreementAxisKey;
  rationaleText?: string;
}
