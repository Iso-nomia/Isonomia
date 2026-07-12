"use client";

import { Badge } from "@/components/ui/badge";
import { Network, AlertCircle, CheckCircle } from "lucide-react";

interface NetDetectionBadgeProps {
  netType: string;
  complexity: number;
  confidence: number;
  isConfirmed: boolean;
  onClick?: () => void;
}

export function NetDetectionBadge({
  netType,
  complexity,
  confidence,
  isConfirmed,
  onClick,
}: NetDetectionBadgeProps) {
  const getColorClass = () => {
    if (isConfirmed) return "bg-green-100 text-green-800 border-green-300";
    if (confidence < 50) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-sky-100 text-sky-800 border-sky-300";
  };

  const Icon = isConfirmed ? CheckCircle : confidence < 50 ? AlertCircle : Network;

  return (
    <Badge
      className={`${getColorClass()} cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1`}
      onClick={onClick}
    >
      <Icon className="h-3 w-3" />
      <span className="capitalize">{netType}</span>
      <span className="text-xs opacity-70">
        {complexity}/100 · {confidence}%
      </span>
    </Badge>
  );
}
