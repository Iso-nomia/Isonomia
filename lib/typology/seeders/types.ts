/**
 * Typology — Seeder shared types
 *
 * Seeders convert facilitation signals (events, metrics, repeated attacks,
 * value-lexicon hits) into pre-axis suggestions that flow into the
 * `TypologyCandidate` queue. Decision #2: seeders never write tags
 * directly — every persisted tag carries explicit human authorship via
 * the candidate-promote flow.
 *
 * Status: B1 scaffold.
 */

import type { FacilitationEvent as PrismaFacilitationEvent } from "@prisma/client";
import {
  DisagreementAxisKey,
  DisagreementTagSeedSource,
  DisagreementTagTargetType,
} from "../types";

export type Priority = 1 | 2 | 3 | 4 | 5;

export interface SeederOutput {
  /** Optional concrete target. Session-scoped seeders (e.g. metric) leave both null. */
  targetType: DisagreementTagTargetType | null;
  targetId: string | null;
  suggestedAxisKey: DisagreementAxisKey;
  rationaleText: string;
  priority: Priority;
  seedSource: DisagreementTagSeedSource;
  /** MUST include `facilitationEventId` when triggered by a FacilitationEvent (idempotency). */
  seedReferenceJson: Record<string, unknown>;
}

export interface SeederDescriptor {
  name: string;
  version: number;
  /** Default-enabled flag. Per-rule env override: `ff_typology_seeder_<name>`. */
  defaultEnabled: boolean;
  flag: string;
}

/**
 * Event-driven seeders consume a single `FacilitationEvent` envelope and
 * return zero-or-one suggestions.
 */
export interface EventSeederContext {
  event: PrismaFacilitationEvent;
}

export interface EventSeederDescriptor extends SeederDescriptor {
  kind: "event";
  /** Filtered set of event types this seeder cares about. */
  eventTypes: ReadonlySet<string>;
  run: (ctx: EventSeederContext) => SeederOutput | null;
}

export type AnySeederDescriptor = EventSeederDescriptor;
