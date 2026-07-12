/**
 * Typology — Intervention seeder
 *
 * Maps `INTERVENTION_APPLIED` (and `INTERVENTION_RECOMMENDED` as a fallback)
 * facilitation events to a typology axis suggestion. The mapping mirrors
 * §4 of docs/typology/MIGRATION_DRAFT.md and the §6 hint table on the
 * roadmap.
 *
 *   PROMPT_EVIDENCE       → EMPIRICAL
 *   ELICIT_UNHEARD        → INTEREST     (someone hasn't been heard; stakes)
 *   REBALANCE_CHALLENGE   → FRAMING      (one side dominates the framing)
 *   REFRAME_QUESTION      → FRAMING
 *   INVITE_RESPONSE       → null         (no axis suggestion)
 *   COOLDOWN              → null
 *   OTHER                 → null
 *
 * Status: B1 scaffold.
 */

import {
  DisagreementAxisKey,
  DisagreementTagSeedSource,
  DisagreementTagTargetType,
} from "../types";
import type { EventSeederDescriptor, SeederOutput } from "./types";

const AXIS_BY_KIND: Partial<Record<string, DisagreementAxisKey>> = {
  PROMPT_EVIDENCE: DisagreementAxisKey.EMPIRICAL,
  ELICIT_UNHEARD: DisagreementAxisKey.INTEREST,
  REBALANCE_CHALLENGE: DisagreementAxisKey.FRAMING,
  REFRAME_QUESTION: DisagreementAxisKey.FRAMING,
};

const TARGET_BY_FACILITATION_TARGET: Partial<Record<string, DisagreementTagTargetType>> = {
  CLAIM: DisagreementTagTargetType.CLAIM,
  ARGUMENT: DisagreementTagTargetType.ARGUMENT,
  // USER and ROOM facilitation targets do not have a tag-able typology target;
  // we emit a session-scoped (null target) candidate in that case.
};

export const interventionSeeder: EventSeederDescriptor = {
  name: "interventionSeeder",
  version: 1,
  defaultEnabled: true,
  flag: "ff_typology_seeder_intervention",
  kind: "event",
  eventTypes: new Set(["INTERVENTION_APPLIED"]),
  run: ({ event }) => {
    const payload = (event.payloadJson ?? {}) as Record<string, unknown>;
    const kind = typeof payload.kind === "string" ? payload.kind : null;
    if (!kind) return null;
    const axisKey = AXIS_BY_KIND[kind];
    if (!axisKey) return null;

    const facilitationTargetType =
      typeof payload.targetType === "string" ? payload.targetType : null;
    const facilitationTargetId =
      typeof payload.targetId === "string" ? payload.targetId : null;
    const targetType = facilitationTargetType
      ? TARGET_BY_FACILITATION_TARGET[facilitationTargetType] ?? null
      : null;

    const out: SeederOutput = {
      targetType: targetType ?? null,
      targetId: targetType && facilitationTargetId ? facilitationTargetId : null,
      suggestedAxisKey: axisKey,
      rationaleText: rationaleFor(kind, axisKey),
      priority: 4,
      seedSource: DisagreementTagSeedSource.INTERVENTION_SEED,
      seedReferenceJson: {
        facilitationEventId: event.id,
        interventionKind: kind,
        interventionId: event.interventionId ?? null,
      },
    };
    return out;
  },
};

function rationaleFor(kind: string, axisKey: DisagreementAxisKey): string {
  switch (axisKey) {
    case DisagreementAxisKey.EMPIRICAL:
      return `Facilitator prompted for evidence (${kind}); the dispute may be empirical.`;
    case DisagreementAxisKey.INTEREST:
      return `Facilitator elicited an unheard voice (${kind}); the dispute may turn on interests.`;
    case DisagreementAxisKey.FRAMING:
      return `Facilitator rebalanced/reframed the discussion (${kind}); the dispute may be a framing disagreement.`;
    default:
      return `Facilitator action: ${kind}.`;
  }
}
