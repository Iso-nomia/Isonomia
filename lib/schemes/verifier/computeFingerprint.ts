/**
 * Spec 4 §3.5 + §4.3 — behaviour fingerprint.
 *
 * Pure function. Same input ⇒ same output across runs. The fingerprint is a
 * **necessary** condition for behaviour equality, not a sufficient one
 * (P3 / Q-021 foreclose a canonical-form route).
 *
 * Domain (the structural fields hashed):
 *   - CQ-bundle structural digest: per CQ {cqKey, attackType, targetScope},
 *     sorted by cqKey for stability.
 *   - Premise variable arity (count + sorted distinct variable names).
 *   - Conclusion variable count.
 *   - `epistemicMode` (widened by Q-020 audit 2026-05-28 §4: two schemes
 *     identical in CQ-bundle but differing in epistemicMode are behaviourally
 *     distinct and must not fingerprint-collide).
 *
 * Out of domain (deliberately):
 *   - CQ free-text (verifier handles via `textNormalisation` policy).
 *   - Provenance, timestamps, popularity, tags, display name.
 *   - Inheritance chain (the verifier walks parents against an *expanded*
 *     bundle when needed; the fingerprint stays local).
 */

import { createHash } from "node:crypto";
import { canonicalize } from "@/lib/canonical/jcs";

type Cq = {
  cqKey: string | null;
  attackType: string | null;
  targetScope: string | null;
};

type SchemeShape = {
  premises: unknown;
  conclusion: unknown;
  epistemicMode?: string | null;
  cqs: Cq[];
};

export type BehaviourFingerprint = string;

type FingerprintDigest = {
  v: 1;
  cqs: Array<{ cqKey: string; attackType: string; targetScope: string }>;
  premiseArity: { count: number; variables: string[] };
  conclusionArity: number;
  epistemicMode: string;
};

function extractVariables(premises: unknown): { count: number; variables: string[] } {
  if (!Array.isArray(premises)) return { count: 0, variables: [] };
  const all = new Set<string>();
  for (const p of premises) {
    const vars = (p as any)?.variables;
    if (Array.isArray(vars)) {
      for (const v of vars) if (typeof v === "string") all.add(v);
    }
  }
  return { count: premises.length, variables: [...all].sort() };
}

function conclusionVariableCount(conclusion: unknown): number {
  const vars = (conclusion as any)?.variables;
  return Array.isArray(vars) ? vars.length : 0;
}

export function computeFingerprintDigest(scheme: SchemeShape): FingerprintDigest {
  const cqs = (scheme.cqs ?? [])
    .map((c) => ({
      cqKey: c.cqKey ?? "",
      attackType: c.attackType ?? "",
      targetScope: c.targetScope ?? "",
    }))
    .sort((a, b) => (a.cqKey < b.cqKey ? -1 : a.cqKey > b.cqKey ? 1 : 0));
  return {
    v: 1,
    cqs,
    premiseArity: extractVariables(scheme.premises),
    conclusionArity: conclusionVariableCount(scheme.conclusion),
    epistemicMode: scheme.epistemicMode ?? "FACTUAL",
  };
}

export function computeBehaviourFingerprint(scheme: SchemeShape): BehaviourFingerprint {
  const digest = computeFingerprintDigest(scheme);
  return createHash("sha256").update(canonicalize(digest), "utf8").digest("hex");
}
