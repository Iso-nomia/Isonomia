/**
 * Test harness for the Round-4 challenge-CQ island e2e
 * (challenge-cq-island.spec.ts, Dev Spec §12).
 *
 * Mounts `AnsweredCriticalQuestions` with a single answered CQ that carries the
 * challenge-affordance props. Playwright drives it with `page.route()` mocks for
 * `/api/me` (session gate) and `/api/cqs/challenge` (the write).
 *
 * Query params let the spec flex the CQ's evidence policy:
 *   ?selfCanonical=1  → answerSelfCanonical=true (AI-provenance nudge)
 *   ?undermineOnly=1  → (unused; UNDERMINE always requires evidence)
 */
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AnsweredCriticalQuestions, {
  type AnsweredCriticalQuestion,
} from "@/components/citation/AnsweredCriticalQuestions";

function Inner() {
  const sp = useSearchParams();
  const selfCanonical = sp?.get("selfCanonical") === "1";

  const item: AnsweredCriticalQuestion = {
    cqKey: "EO1",
    question: "Is the source actually an expert in the relevant field?",
    answer: "Yes — the cited author holds a chair in the relevant discipline.",
    sourceUrls: [],
    schemeKey: "expert-opinion",
    answeredAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    cqStatusEnum: "SATISFIED",
    challengeCount: 0,
    argumentId: "arg-harness-0001",
    cqRequiresEvidence: false,
    cqBurden: "PROPONENT",
    answerSelfCanonical: selfCanonical,
    answerAuthorKind: selfCanonical ? "AI" : "HUMAN",
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-lg font-semibold text-slate-900 mb-4">
        §12 — challenge-CQ island harness
      </h1>
      <AnsweredCriticalQuestions items={[item]} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
