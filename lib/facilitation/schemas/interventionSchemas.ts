/**
 * Facilitation — Zod schemas: interventions
 */

import { z } from "zod";
import { FacilitationDismissalTag } from "../types";

export const ApplyInterventionSchema = z.object({
  noteText: z.string().max(2048).nullish(),
});
export type ApplyInterventionInput = z.infer<typeof ApplyInterventionSchema>;

/**
 * Locked decision #4: free-text reason is REQUIRED on dismiss; structured tag
 * is optional. Empty / whitespace-only text is rejected.
 */
export const DismissInterventionSchema = z.object({
  reasonText: z
    .string()
    .min(1)
    .max(2048)
    .refine((s) => s.trim().length > 0, "reasonText is required"),
  reasonTag: z.nativeEnum(FacilitationDismissalTag).nullish(),
});
export type DismissInterventionInput = z.infer<typeof DismissInterventionSchema>;

export const ListInterventionsQuerySchema = z.object({
  status: z.enum(["open", "applied", "dismissed", "all"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
