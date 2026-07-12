
// lib/dialogue/wellformedness.ts
import type { WCode } from "./codes";
export function wffChecksForTherefore({ hasAntecedents, isFirstMove, labelExists }: {hasAntecedents:boolean;isFirstMove:boolean;labelExists:boolean;}) {
  const out: WCode[] = [];
  if (isFirstMove) out.push("W0_NO_INITIAL_THEREFORE");
  if (!labelExists) out.push("W1_UNKNOWN_LABEL");
  if (!hasAntecedents) out.push("W5_THEREFORE_TEST_FAIL");
  return out;
}
