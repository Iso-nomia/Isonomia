/**
 * Facilitation — Zod schemas: questions
 */

import { z } from "zod";
import { FacilitationFramingType } from "../types";

const cuid = z.string().min(1);

export const AuthorQuestionSchema = z.object({
  text: z.string().min(1).max(4096),
  framingType: z.nativeEnum(FacilitationFramingType),
});
export type AuthorQuestionInput = z.infer<typeof AuthorQuestionSchema>;

export const ReviseQuestionSchema = z.object({
  text: z.string().min(1).max(4096),
  framingType: z.nativeEnum(FacilitationFramingType).optional(),
});
export type ReviseQuestionInput = z.infer<typeof ReviseQuestionSchema>;

export const RunCheckSchema = z.object({}).passthrough().optional();

export const LockQuestionSchema = z.object({
  acknowledgedCheckIds: z.array(cuid).default([]),
});
export type LockQuestionInput = z.infer<typeof LockQuestionSchema>;

export const ReopenQuestionSchema = z.object({
  reasonText: z.string().min(1).max(2048),
});
export type ReopenQuestionInput = z.infer<typeof ReopenQuestionSchema>;
