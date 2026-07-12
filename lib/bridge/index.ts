// lib/bridge/index.ts
//
// Foundational-bridge (direction 1) — Phase 2 prototype public surface.
// See RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/02b-translation-spec-af-to-designs-2026-06-02.md

export type {
  AF,
  ArgId,
  Attack,
  BridgeAct,
  DisputeDesign,
  InteractionStatus,
  ActPolarity,
} from "./types";

export {
  attackersOf,
  enumerateStrategies,
  interact,
  acceptableByInteraction,
  disputeWins,
  buildDisputeDesign,
  type Strategy,
  type AcceptanceResult,
} from "./dispute";

export {
  buildAdditiveDisputeDesign,
  acceptableByAdditiveInteraction,
  forkCensus,
  conflictFree,
  allAttacking,
  isStableByAdditive,
  stableExtensionsByAdditive,
  credulouslyStableByAdditive,
  skepticallyStableByAdditive,
  isAdmissibleByAdditive,
  preferredExtensionsByAdditive,
  credulouslyPreferredByAdditive,
  skepticallyPreferredByAdditive,
  type ForkCensus,
  type AdditiveAcceptanceResult,
} from "./disputeAdditive";
