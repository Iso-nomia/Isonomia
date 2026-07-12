// components/aif/SchemeBadge.tsx
"use client";
import { Badge } from "@/components/ui/badge";

type SchemeBadgeProps = {
  schemeKey: string | null | undefined;
  schemeName?: string | null;
  className?: string;
};

const SCHEME_COLORS: Record<string, string> = {
  expert_opinion: "bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100",
  popular_opinion: "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100",
  popular_practice: "bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
  argument_from_division: "bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-100",
  argument_from_analogy: "bg-cyan-100 text-cyan-700 border-cyan-200 hover:bg-cyan-100",
  cause_to_effect: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  default: "bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-100",
};

export function SchemeBadge({ schemeKey, schemeName, className = "" }: SchemeBadgeProps) {
  if (!schemeKey) return null;

  const colorClass = SCHEME_COLORS[schemeKey] ?? SCHEME_COLORS.default;
  const displayName = schemeName ?? schemeKey.replace(/_/g, " ");

  return (
    <Badge variant="outline" className={`text-[10px] ${colorClass} ${className}`}>
      {displayName}
    </Badge>
  );
}
