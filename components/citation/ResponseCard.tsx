import { CornerDownRight, ShieldCheck, Handshake, Clock, Bot, User, Users } from "lucide-react";
import type { ResponseVM, AuthorKind } from "@/lib/citations/argumentDialectic";
import EvidenceCard from "./EvidenceCard";

/**
 * An indented defense / concession posted in reply to a filed attack. The
 * variant tag distinguishes a defense (holds the line) from a concession
 * (yields ground); a defense stays "Under review" until adjudicated.
 *
 * Server-safe (presentational).
 */

const VARIANT: Record<
  ResponseVM["variant"],
  { label: string; icon: typeof ShieldCheck; className: string }
> = {
  defense: {
    label: "Defense",
    icon: ShieldCheck,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  concession: {
    label: "Concession",
    icon: Handshake,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  "partial-concession": {
    label: "Partial concession",
    icon: Handshake,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

const AUTHOR_ICON: Record<AuthorKind, typeof User> = {
  HUMAN: User,
  AI: Bot,
  HYBRID: Users,
};

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

export default function ResponseCard({ response }: { response: ResponseVM }) {
  const variant = VARIANT[response.variant];
  const VariantIcon = variant.icon;
  const AuthorIcon = AUTHOR_ICON[response.authorKind];
  const pending = response.status === "PENDING_REVIEW";

  return (
    <div className="relative pl-5 mt-2">
      {/* Threading connector */}
      <CornerDownRight className="absolute left-0 top-2 w-3.5 h-3.5 text-emerald-400" />
      <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/30 px-3 py-2.5">
        <div className="flex items-center flex-wrap gap-2 mb-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[0.06em] uppercase border ${variant.className}`}
          >
            <VariantIcon className="w-3 h-3" />
            Response · {variant.label}
          </span>
          {pending ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-amber-700 bg-amber-100/70">
              <Clock className="w-3 h-3" />
              Under review
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-700 bg-emerald-100/70">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Effective
            </span>
          )}
        </div>
        <p className="text-sm text-slate-800 leading-relaxed">
          {response.groundsText}
        </p>
        {response.evidence.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2">
            {response.evidence.map((ev) => (
              <EvidenceCard key={ev.id} evidence={ev} />
            ))}
          </div>
        )}
        {/* <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500">
          <AuthorIcon className="w-3 h-3" />
          <span className="font-medium">
            {response.authorKind === "AI"
              ? "AI"
              : response.authorKind === "HYBRID"
                ? "Human + AI"
                : "Human"}
          </span>
          <span className="text-slate-300">·</span>
          <span>{formatDate(response.createdAt)}</span>
        </div> */}
      </div>
    </div>
  );
}
