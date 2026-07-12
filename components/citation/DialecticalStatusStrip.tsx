import {
  Circle,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";
import type {
  DialecticalLayer,
  StandingState,
} from "@/lib/citations/argumentDialectic";

/**
 * At-a-glance dialectical standing for the argument. Placed high on the page
 * (right after the argument core) so the reader learns the standing before
 * reading the debate.
 *
 * Two invariants from the spec:
 *   - Standing is always paired with **depth**: "undermined by one thin AI
 *     voice" ≠ "contested by the field".
 *   - A `PROPOSED`-heavy record must never read as "defeated" — depth counts
 *     are distinct authors, not attack counts.
 *
 * Server-safe: the "how computed" disclosure is a native `<details>`.
 */

const STANDING: Record<
  StandingState,
  { label: string; icon: typeof Circle; tone: string; dot: string }
> = {
  "untested-default": {
    label: "Untested",
    icon: Circle,
    tone: "text-slate-600",
    dot: "bg-slate-300",
  },
  "untested-supported": {
    label: "Supported — untested",
    icon: ShieldQuestion,
    tone: "text-sky-700",
    dot: "bg-sky-400",
  },
  "tested-attacked": {
    label: "Tested — under attack",
    icon: ShieldAlert,
    tone: "text-amber-700",
    dot: "bg-amber-500",
  },
  "tested-undermined": {
    label: "Tested — undermined",
    icon: ShieldAlert,
    tone: "text-rose-700",
    dot: "bg-rose-500",
  },
  "tested-undercut": {
    label: "Tested — undercut",
    icon: ShieldAlert,
    tone: "text-rose-700",
    dot: "bg-rose-500",
  },
  "tested-survived": {
    label: "Tested — survived",
    icon: ShieldCheck,
    tone: "text-emerald-700",
    dot: "bg-emerald-500",
  },
};

const DEPTH_LABEL: Record<DialecticalLayer["standing"]["depthConfidence"], string> =
  {
    thin: "thin",
    moderate: "moderate",
    dense: "dense",
  };

export default function DialecticalStatusStrip({
  standing,
  counts,
}: {
  standing: DialecticalLayer["standing"];
  counts: DialecticalLayer["counts"];
}) {
  const meta = STANDING[standing.state] ?? STANDING["untested-default"];
  const StatusIcon = meta.icon;
  const fb = standing.fitnessBreakdown;

  return (
    <section className="rounded-2xl p-4 mb-6 panelv2">
      <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
        <div className={`inline-flex items-center gap-2 font-semibold ${meta.tone}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
          <StatusIcon className="w-4 h-4" />
          <span className="text-sm">{meta.label}</span>
        </div>

        <div className="text-xs text-slate-500">
          Depth:{" "}
          <span className="font-semibold text-slate-700">
            {DEPTH_LABEL[standing.depthConfidence]}
          </span>{" "}
          · {standing.challengers} challenger
          {standing.challengers === 1 ? "" : "s"} ·{" "}
          {standing.independentReviewers} independent
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        {counts.challenges} challenge{counts.challenges === 1 ? "" : "s"} ·{" "}
        {counts.responses} response{counts.responses === 1 ? "" : "s"} ·{" "}
        {counts.cqAnsweredPending} CQ
        {counts.cqAnsweredPending === 1 ? "" : "s"} answered
      </div>

      {fb && (
        <details className="mt-2 group">
          <summary className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer list-none">
            <Circle className="w-3 h-3" />
            how this standing is computed
          </summary>
          <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3">
            <div className="text-[11px] text-slate-500 mb-2 leading-relaxed">
              A dialectical-fitness score weights answered CQs and supports
              against filed attacks. Higher is more resilient.
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="font-semibold pb-1">Component</th>
                  <th className="font-semibold pb-1 text-right">Count</th>
                  <th className="font-semibold pb-1 text-right">Weight</th>
                  <th className="font-semibold pb-1 text-right">Contribution</th>
                </tr>
              </thead>
              <tbody className="text-slate-600 font-mono">
                {(
                  [
                    ["CQs answered", fb.components.cqAnswered],
                    ["Support edges", fb.components.supportEdges],
                    ["Attack edges", fb.components.attackEdges],
                    ["Attack CAs", fb.components.attackCAs],
                    [
                      "Evidence w/ provenance",
                      fb.components.evidenceWithProvenance,
                    ],
                  ] as const
                ).map(([label, c]) => (
                  <tr key={label}>
                    <td className="py-0.5 font-sans">{label}</td>
                    <td className="py-0.5 text-right">{c.count}</td>
                    <td className="py-0.5 text-right">{c.weight}</td>
                    <td className="py-0.5 text-right">
                      {c.contribution.toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-bold text-slate-800">
                  <td className="pt-1 font-sans" colSpan={3}>
                    Total
                  </td>
                  <td className="pt-1 text-right">{fb.total.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
