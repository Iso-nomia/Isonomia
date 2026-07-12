/**
 * Facilitation — Zod schemas: sessions
 */

import { z } from "zod";

const cuid = z.string().min(1);

export const OpenSessionSchema = z.object({
  isPublic: z.boolean().optional(),
  summary: z.string().max(2048).nullish(),
});
export type OpenSessionInput = z.infer<typeof OpenSessionSchema>;

export const CloseSessionSchema = z.object({
  summary: z.string().max(4096).nullish(),
});
export type CloseSessionInput = z.infer<typeof CloseSessionSchema>;

export const InitiateHandoffSchema = z.object({
  toUserId: z.string().min(1),
  notesText: z.string().max(2048).nullish(),
});
export type InitiateHandoffInput = z.infer<typeof InitiateHandoffSchema>;

export const RespondHandoffSchema = z.object({
  notesText: z.string().max(2048).nullish(),
});
export type RespondHandoffInput = z.infer<typeof RespondHandoffSchema>;

export const ListEventsQuerySchema = z.object({
  cursor: cuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  eventType: z.string().optional(),
});
