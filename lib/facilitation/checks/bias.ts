/**
 * BIAS check (v1 stub) — see docs/facilitation/QUESTION_CHECKS.md §6.
 *
 * Reserved enum value; runner produces no rows under this kind in v1.
 * Wired only so v1.1 can land without a service-shape change.
 */

import type { CheckFn } from "./types";

export const biasCheck: CheckFn = () => [];
