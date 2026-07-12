import { HelpCircle, CircleDashed, Clock, CircleDot, ExternalLink, PenLine, Swords } from "lucide-react";

/**
 * One pending critical question — a challenge this argument's reasoning
 * pattern must still withstand but has not yet satisfied. Assembled in the
 * argument page from the attestation aggregate's `unanswered` /
 * `partiallyAnswered` buckets. No canonical answer exists yet, so this carries
 * only the question and its open/partial status.
 */
export type PendingCriticalQuestion = {
  cqKey: string;
  question: string;
  schemeKey: string | null;
  /**
   * Projected CQ status. `"open"`/`"missing"` mean untouched; `"pending_review"`
   * and `"partially_satisfied"` mean an answer is in progress but not yet
   * canonical. `"disputed"` answers are surfaced in the answered card instead,
   * so they should be filtered out before reaching here.
   */
  status:
    | "missing"
    | "open"
    | "pending_review"
    | "partially_satisfied"
    | "satisfied"
    | "disputed";
  /**
   * Carneades premise classification of the CQ's target premise. `ASSUMPTION`
   * CQs auto-waive at gate-check time, so they are informational rather than
   * blocking.
   */
  premiseType: "ORDINARY" | "ASSUMPTION" | "EXCEPTION" | null;
  /**
   * True iff this CQ must be actively adjudicated for the argument instance to
   * close (i.e. it is not an auto-waiving assumption).
   */
  isSchemeRequired: boolean;
  /**
   * An in-progress (non-canonical) draft answer for this CQ, if one exists —
   * e.g. a partially-answered or under-review CQ. `null` when the CQ is
   * untouched.
   */
  answer: string | null;
  /** Source URLs attached to the draft answer, if any. */
  sourceUrls: string[];
  /**
   * Set when a filed attack on the graph *instantiates* this latent CQ — the
   * `ConflictApplication.id` of the thread to scroll to in the Challenges &
   * Responses section (spec §6.2). Prevents the pending-CQ list and the filed
   * attacks reading as two unrelated "challenge" lists.
   */
  challengedThreadId?: string | null;
};

function statusLabel(status: PendingCriticalQuestion["status"]): {
  label: string;
  className: string;
  icon: typeof CircleDashed;
} {
  switch (status) {
    case "partially_satisfied":
      return {
        label: "Partially answered",
        className: "bg-sky-100 text-sky-700",
        icon: CircleDot,
      };
    case "pending_review":
      return {
        label: "Answer under review",
        className: "bg-amber-100 text-amber-700",
        icon: Clock,
      };
    default:
      return {
        label: "Open",
        className: "bg-slate-100 text-slate-600",
        icon: CircleDashed,
      };
  }
}

/**
 * Public-page section that surfaces the critical questions this argument has
 * *not yet* satisfied — the outstanding challenges its scheme still has to
 * withstand. Renders nothing when there are no pending CQs, so it stays
 * invisible until the argument has open questions.
 */
export default function PendingCriticalQuestions({
  items,
}: {
  items: PendingCriticalQuestion[];
}) {
  if (!items || items.length === 0) return null;

  return (
    <section className="rounded-2xl p-6 mb-6 panelv2">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/15 text-amber-600">
          <HelpCircle className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-[12px] font-bold tracking-[0.1em] uppercase text-slate-700">
          Pending critical questions ({items.length})
        </h3>
      </div>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        These are challenges this argument&rsquo;s reasoning pattern must still
        withstand. Answering them on Isonomia strengthens the argument.
      </p>

      <ul className="flex flex-col gap-2.5">
        {items.map((cq) => {
          const { label, className, icon: StatusIcon } = statusLabel(cq.status);
          return (
            <li
              key={cq.cqKey}
              className="border border-amber-200/70 bg-amber-50/20 rounded-xl px-4 py-3"
            >
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-slate-800 leading-snug flex-1">
                  {cq.question}
                </span>
                <span
                  className={`inline-flex items-center gap-1 flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[0.08em] uppercase ${className}`}
                >
                  <StatusIcon className="w-3 h-3" />
                  {label}
                </span>
              </div>
              {cq.challengedThreadId && (
                <div className="mt-1.5 pl-6">
                  <a
                    href={`#challenge-${cq.challengedThreadId}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[0.06em] uppercase bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                  >
                    <Swords className="w-3 h-3" />
                    challenged on the graph
                  </a>
                </div>
              )}
              {cq.answer && (
                <div className="mt-2.5 pl-6">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <PenLine className="w-3 h-3 text-amber-600" />
                    <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-amber-700">
                      Draft answer
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {cq.answer}
                  </p>
                  {cq.sourceUrls.length > 0 && (
                    <div className="mt-2.5 flex flex-col gap-1 pt-2.5 border-t border-amber-200/50">
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
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
