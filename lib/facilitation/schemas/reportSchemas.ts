/**
 * Facilitation — Zod schemas: report
 */

import { z } from "zod";

export const ReportQuerySchema = z.object({
  format: z.enum(["json", "summary"]).optional(),
});
