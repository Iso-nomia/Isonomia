/**
 * Typology — Zod schemas
 *
 * Request-body schemas for the typology REST surface. Service code uses
 * these for input validation; route handlers convert ZodError → 422 via
 * `apiHelpers.zodError()`.
 *
 * Status: B1 scaffold.
 */

import { z } from "zod";
import {
  DisagreementAxisKey,
  DisagreementTagAuthorRole,
  DisagreementTagSeedSource,
  DisagreementTagTargetType,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Tags
// ─────────────────────────────────────────────────────────────────────────────

export const ProposeTagSchema = z.object({
  targetType: z.nativeEnum(DisagreementTagTargetType),
  targetId: z.string().min(1),
  axisKey: z.nativeEnum(DisagreementAxisKey),
  confidence: z.number().min(0).max(1),
  evidenceText: z.string().min(1).max(4000),
  evidenceJson: z.record(z.unknown()).optional(),
  sessionId: z.string().min(1).optional().nullable(),
  authoredRole: z.nativeEnum(DisagreementTagAuthorRole).default(DisagreementTagAuthorRole.PARTICIPANT),
  seedSource: z.nativeEnum(DisagreementTagSeedSource).default(DisagreementTagSeedSource.MANUAL),
  seedReferenceJson: z.record(z.unknown()).optional(),
  promotedFromCandidateId: z.string().min(1).optional(),
});
export type ProposeTagInput = z.infer<typeof ProposeTagSchema>;

export const ConfirmTagSchema = z.object({
  /** Optional override of confidence at confirm time. */
  confidence: z.number().min(0).max(1).optional(),
});
export type ConfirmTagInput = z.infer<typeof ConfirmTagSchema>;

export const RetractTagSchema = z.object({
  reasonText: z.string().min(1, "reasonText is required").max(2000).transform((s) => s.trim()).refine((s) => s.length > 0, "reasonText is required"),
});
export type RetractTagInput = z.infer<typeof RetractTagSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Candidates
// ─────────────────────────────────────────────────────────────────────────────

export const EnqueueCandidateSchema = z.object({
  sessionId: z.string().min(1),
  targetType: z.nativeEnum(DisagreementTagTargetType).optional().nullable(),
  targetId: z.string().min(1).optional().nullable(),
  suggestedAxisKey: z.nativeEnum(DisagreementAxisKey),
  seedSource: z.nativeEnum(DisagreementTagSeedSource),
  seedReferenceJson: z.record(z.unknown()),
  rationaleText: z.string().min(1).max(4000),
  priority: z.number().int().min(1).max(5),
  ruleName: z.string().min(1),
  ruleVersion: z.number().int().min(1),
});
export type EnqueueCandidateInput = z.infer<typeof EnqueueCandidateSchema>;

export const PromoteCandidateSchema = z.object({
  /** Override confidence when promoting; default = 0.5. */
  confidence: z.number().min(0).max(1).optional(),
  /** Override evidence text; defaults to candidate.rationaleText. */
  evidenceText: z.string().min(1).max(4000).optional(),
  /** Override the suggested axis; default = candidate.suggestedAxisKey. */
  axisKey: z.nativeEnum(DisagreementAxisKey).optional(),
  /** When promoting on behalf of a session-scoped tag (defaults to candidate.sessionId). */
  sessionScope: z.boolean().default(true),
});
export type PromoteCandidateInput = z.infer<typeof PromoteCandidateSchema>;

export const DismissCandidateSchema = z.object({
  reasonText: z.string().min(1).max(2000).transform((s) => s.trim()).refine((s) => s.length > 0, "reasonText is required"),
});
export type DismissCandidateInput = z.infer<typeof DismissCandidateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Summaries
// ─────────────────────────────────────────────────────────────────────────────

export const SummaryBodySchema = z.object({
  agreedOn: z.array(z.string().min(1).max(2000)).default([]),
  disagreedOn: z
    .array(
      z.object({
        axisKey: z.nativeEnum(DisagreementAxisKey),
        summary: z.string().min(1).max(4000),
        supportingTagIds: z.array(z.string().min(1)).default([]),
      }),
    )
    .default([]),
  blockers: z.array(z.string().min(1).max(2000)).default([]),
  nextSteps: z.array(z.string().min(1).max(2000)).default([]),
});
export type SummaryBodyInput = z.infer<typeof SummaryBodySchema>;

export const DraftSummarySchema = z.object({
  sessionId: z.string().min(1).optional().nullable(),
  bodyJson: SummaryBodySchema,
  narrativeText: z.string().max(20_000).optional().nullable(),
  parentSummaryId: z.string().min(1).optional().nullable(),
});
export type DraftSummaryInput = z.infer<typeof DraftSummarySchema>;

export const EditDraftSchema = z.object({
  bodyJson: SummaryBodySchema.optional(),
  narrativeText: z.string().max(20_000).optional().nullable(),
});
export type EditDraftInput = z.infer<typeof EditDraftSchema>;

export const PublishSummarySchema = z.object({}).strict();
export type PublishSummaryInput = z.infer<typeof PublishSummarySchema>;

export const RetractSummarySchema = z.object({
  reasonText: z.string().min(1).max(2000).transform((s) => s.trim()).refine((s) => s.length > 0, "reasonText is required"),
});
export type RetractSummaryInput = z.infer<typeof RetractSummarySchema>;
