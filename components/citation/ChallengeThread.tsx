import {
  Swords,
  Scissors,
  Pickaxe,
  Bot,
  User,
  Users,
  ArrowUpRight,
  Target,
} from "lucide-react";
import type {
  ChallengeThreadVM,
  AttackType,
  AuthorKind,
} from "@/lib/citations/argumentDialectic";
import EvidenceCard from "./EvidenceCard";
import ResponseCard from "./ResponseCard";

/**
 * One filed attack and its nested responses. Header carries the four things a
 * reader needs to place the challenge: attack-type icon, the anchored target,
 * a ratification pill (solid = live defeat-candidate, hollow = pending
 * sign-off, muted = withdrawn), and an author-kind badge.
 *
 * Server-safe (presentational).
 */

const TYPE: Record<AttackType, { label: string; icon: typeof Swords }> = {
  REBUT: { label: "Rebut", icon: Swords },
  UNDERCUT: { label: "Undercut", icon: Scissors },
  UNDERMINE: { label: "Undermine", icon: Pickaxe },
};

const AUTHOR_ICON: Record<AuthorKind, typeof User> = {
  HUMAN: User,
  AI: Bot,
  HYBRID: Users,
};

function ratificationPill(status: ChallengeThreadVM["ratificationStatus"]) {
  switch (status) {
    case "EFFECTIVE":
      return {
        label: "Effective",
        dot: <span className="w-2 h-2 rounded-full bg-rose-500" />,
        className: "text-rose-700 bg-rose-100/70",
      };
    case "PROPOSED":
      return {
        label: "Proposed · pending sign-off",
        dot: (
          <span className="w-2 h-2 rounded-full border-[1.5px] border-rose-400 bg-transparent" />
        ),
        className: "text-rose-600/80 bg-rose-50",
      };
    case "WITHDRAWN":
      return {
        label: "Withdrawn",
        dot: <span className="w-2 h-2 rounded-full bg-slate-300" />,
        className: "text-slate-400 bg-slate-100 line-through",
      };
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export default function ChallengeThread({
  thread,
  respondHref,
}: {
  thread: ChallengeThreadVM;
  /** Deep link into the "Join & respond" flow, target pre-filled. */
  respondHref?: string;
}) {
  const type = TYPE[thread.attackType];
  const TypeIcon = type.icon;
  const AuthorIcon = AUTHOR_ICON[thread.authorKind];
  const pill = ratificationPill(thread.ratificationStatus);
  const withdrawn = thread.ratificationStatus === "WITHDRAWN";

  return (
    <div
      id={`challenge-${thread.id}`}
      className={`rounded-xl border scroll-mt-20 ${
        withdrawn
          ? "border-slate-200 bg-slate-50/40 opacity-70"
          : "border-rose-200/70 bg-rose-50/20"
      }`}
    >
      {/* Attack header */}
      <div className="px-4 py-3">
        <div className="flex items-center flex-wrap gap-2 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[0.08em] uppercase text-rose-700 bg-rose-100/70 border border-rose-200">
            <TypeIcon className="w-3 h-3" />
            {type.label}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Target className="w-3 h-3" />
            on {thread.target.label}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ml-auto ${pill.className}`}
          >
            {pill.dot}
            {pill.label}
          </span>
        </div>

        <p className="text-sm font-medium text-slate-900 leading-relaxed">
          {thread.groundsText}
        </p>

        {thread.instantiatesCqKey && (
          <div className="mt-1.5 text-[11px] text-slate-500">
            <span className="text-rose-500">↳</span> instantiates CQ:{" "}
            <span className="font-mono font-semibold text-slate-600">
              {thread.instantiatesCqKey}
            </span>
          </div>
        )}

        {thread.evidence.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2.5">
            {thread.evidence.map((ev) => (
              <EvidenceCard key={ev.id} evidence={ev} />
            ))}
          </div>
        )}

        {/* <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500">
          <AuthorIcon className="w-3 h-3" />
          <span className="font-medium">
            {thread.authorKind === "AI"
              ? "AI"
              : thread.authorKind === "HYBRID"
                ? "Human + AI"
                : "Human"}
          </span>
          <span className="text-slate-300">·</span>
          <span>{formatDate(thread.createdAt)}</span>
        </div> */}

        {/* Responses */}
        {thread.responses.map((resp) => (
          <ResponseCard key={resp.id} response={resp} />
        ))}
      </div>

      {/* CTAs */}
      {respondHref && !withdrawn && (
        <div className="px-4 py-2.5 border-t border-rose-200/50 flex items-center gap-3">
          <a
            href={respondHref}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Respond to this challenge
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
