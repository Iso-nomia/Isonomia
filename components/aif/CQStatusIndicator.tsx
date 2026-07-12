// components/aif/CQStatusIndicator.tsx
"use client";
import { Badge } from "@/components/ui/badge";

type CQStatusIndicatorProps = {
  required: number;
  satisfied: number;
  className?: string;
};

export function CQStatusIndicator({ required, satisfied, className = "" }: CQStatusIndicatorProps) {
  if (required === 0) return null;

  const hasOpenCQs = satisfied < required;
  const bgColor = hasOpenCQs ? "bg-orange-100 text-orange-700 border-orange-300" : "bg-emerald-100 text-emerald-700 border-emerald-300";

  return (
    <Badge variant="outline" className={`text-[10px] ${bgColor} ${className}`} title={`${satisfied}/${required} CQs answered`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${hasOpenCQs ? "bg-orange-500" : "bg-emerald-500"}`} />
      CQ {satisfied}/{required}
    </Badge>
  );
}
