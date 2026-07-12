import { CheckCircle2, HelpCircle, ExternalLink, AlertTriangle } from "lucide-react";
import ChallengeCqAffordance from "./ChallengeCqAffordance";

/**
 * One answered critical question with its canonical answer, assembled in the
 * argument page from the attestation aggregate (question text + status) joined
 * to the canonical `CQResponse` (the answer body + sources).
 */
export type AnsweredCriticalQuestion = {
  cqKey: string;
  question: string;
  answer: string;
  sourceUrls: string[];
  schemeKey: string | null;
  answeredAt: string | null;
  /**
   * `CQStatus.statusEnum`. `"DISPUTED"` means a structural contester has
   * re-opened this answer (Challenging-Answered-CQ §11.6) — the card renders an
   * amber "Disputed" badge + a challenge-count line for it. `null`/other values
   * render the default emerald "Answered" treatment.
   */
  cqStatusEnum?: "OPEN" | "PENDING_REVIEW" | "PARTIALLY_SATISFIED" | "SATISFIED" | "DISPUTED" | null;
  /** Number of challenges (`CQAttack` rows) on file for this CQ (§11.6). */
  challengeCount?: number;
  /**
   * The argument carrying this CQ. Passed to the challenge affordance so the
   * client island never re-fetches (§12.2).
   */
  argumentId?: string;
  /** `CriticalQuestion.requiresEvidence` — drives the client admissibility mirror (§12.3). */
  cqRequiresEvidence?: boolean;
  /** `CriticalQuestion.burdenOfProof` — drives the client admissibility mirror (§12.3). */
  cqBurden?: "PROPONENT" | "CHALLENGER" | "OPPONENT";
  /**
   * Whether the canonical answer was self-asserted by an AI agent over MCP
   * (§12.1). Drives the "answered by an AI agent" challenge nudge — disclosure
   * only, never gates anything.
   */
  answerSelfCanonical?: boolean;
  /** The answer's authorship proxy (§12.1). */
  answerAuthorKind?: "HUMAN" | "AI" | "HYBRID";
};

/**
 * Public-page section that surfaces the critical questions this argument has
 * satisfied. Critical questions are the literature-required challenges a
 * scheme must withstand; a *satisfied* one carries a canonical answer. Renders
 * nothing when the argument has no answered CQs, so it stays invisible until it
 * has something to say.
 */
export default function AnsweredCriticalQuestions({
  items,
}: {
  items: AnsweredCriticalQuestion[];
}) {
  if (!items || items.length === 0) return null;

  return (
    <section className="rounded-2xl p-6 mb-6 panelv2">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/10 to-green-500/15 text-emerald-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-[12px] font-bold tracking-[0.1em] uppercase text-slate-700">
          Answered critical questions ({items.length})
        </h3>
      </div>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Critical questions are the challenges this argument&rsquo;s reasoning
        pattern must withstand. 
      </p>

      <ul className="flex flex-col gap-3">
        {items.map((cq) => {
          const isDisputed = cq.cqStatusEnum === "DISPUTED";
          const challengeCount = cq.challengeCount ?? 0;
          return (
          <li
            key={cq.cqKey}
            className={
              isDisputed
                ? "border border-amber-300/70 bg-amber-50/30 rounded-xl overflow-hidden"
                : "border border-emerald-200/70 bg-emerald-50/30 rounded-xl overflow-hidden"
            }
          >
            <div
              className={
                isDisputed
                  ? "flex items-start gap-2 px-4 py-3 bg-amber-50/60 border-b border-amber-200/60"
                  : "flex items-start gap-2 px-4 py-3 bg-emerald-50/60 border-b border-emerald-200/60"
              }
            >
              <HelpCircle
                className={
                  isDisputed
                    ? "w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"
                    : "w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5"
                }
              />
              <span className="text-sm font-semibold text-slate-800 leading-snug flex-1">
                {cq.question}
              </span>
              {isDisputed && (
                <span className="inline-flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold tracking-[0.08em] uppercase">
                  <AlertTriangle className="w-3 h-3" />
                  Disputed
                </span>
              )}
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CheckCircle2
                  className={
                    isDisputed ? "w-3 h-3 text-amber-600" : "w-3 h-3 text-emerald-600"
                  }
                />
                <span
                  className={
                    isDisputed
                      ? "text-[10px] font-bold tracking-[0.1em] uppercase text-amber-700"
                      : "text-[10px] font-bold tracking-[0.1em] uppercase text-emerald-700"
                  }
                >
                  {isDisputed ? "Canonical answer (contested)" : "Answer"}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {cq.answer}
              </p>
              {cq.sourceUrls.length > 0 && (
                <div
                  className={
                    isDisputed
                      ? "mt-2.5 flex flex-col gap-1 pt-2.5 border-t border-amber-200/50"
                      : "mt-2.5 flex flex-col gap-1 pt-2.5 border-t border-emerald-200/50"
                  }
                >
                  {cq.sourceUrls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-mono break-all"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      {url}
                    </a>
                  ))}
                </div>
              )}
              {isDisputed && (
                <div className="mt-2.5 flex items-center gap-1.5 pt-2.5 border-t border-amber-200/50">
                  <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <span className="text-xs text-amber-700/90 leading-relaxed">
                    {challengeCount === 1
                      ? "1 challenge on file"
                      : `${challengeCount} challenges on file`}
                    {" \u2014 this answer has been contested and is being re-examined."}
                  </span>
                </div>
              )}
              {cq.argumentId && (
                <ChallengeCqAffordance
                  argumentId={cq.argumentId}
                  cqKey={cq.cqKey}
                  schemeKey={cq.schemeKey}
                  cqRequiresEvidence={cq.cqRequiresEvidence ?? false}
                  cqBurden={cq.cqBurden ?? "PROPONENT"}
                  answerSelfCanonical={cq.answerSelfCanonical ?? false}
                />
              )}
            </div>
          </li>
          );
        })}
      </ul>
    </section>
  );
}
