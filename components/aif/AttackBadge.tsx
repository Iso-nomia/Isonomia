// components/aif/AttackBadge.tsx
"use client";
import { Badge } from "@/components/ui/badge";

type AttackBadgeProps = {
  attacks: { REBUTS: number; UNDERCUTS: number; UNDERMINES: number };
  className?: string;
};

export function AttackBadge({ attacks, className = "" }: AttackBadgeProps) {
  const total = attacks.REBUTS + attacks.UNDERCUTS + attacks.UNDERMINES;
  if (total === 0) return null;

  return (
    <Badge 
      variant="outline" 
      className={`text-[10px] bg-red-50 text-red-700 border-red-200 hover:bg-red-50 ${className}`}
      title={`${attacks.REBUTS} rebuts, ${attacks.UNDERCUTS} undercuts, ${attacks.UNDERMINES} undermines`}
    >
      ⚔ {total}
      {(attacks.REBUTS > 0 || attacks.UNDERCUTS > 0 || attacks.UNDERMINES > 0) && (
        <span className="ml-1 text-[9px] text-red-600">
          (R:{attacks.REBUTS} U:{attacks.UNDERCUTS} M:{attacks.UNDERMINES})
        </span>
      )}
    </Badge>
  );
}
