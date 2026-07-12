/**
 * Facilitation — Zod schemas: metrics
 */

import { z } from "zod";
import { EquityMetricKind } from "../types";

export const CurrentMetricsQuerySchema = z.object({
  window: z.enum(["current", "final"]).optional(),
});

export const MetricHistoryQuerySchema = z.object({
  metricKind: z.nativeEnum(EquityMetricKind),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
