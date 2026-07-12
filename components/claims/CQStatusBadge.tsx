//components/claims/CQStatusBadge.tsx
"use client";

import * as React from "react";
import {
  HelpCircle,
  Clock,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

type CQStatusEnum =
  | "OPEN"
  | "PENDING_REVIEW"
  | "PARTIALLY_SATISFIED"
  | "SATISFIED"
  | "DISPUTED";

type CQStatusBadgeProps = {
  status: CQStatusEnum;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
};

const statusConfig: Record<
  CQStatusEnum,
  {
    label: string;
    shortLabel: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  OPEN: {
    label: "Open",
    shortLabel: "Open",
    icon: HelpCircle,
    color: "text-slate-700",
    bgColor: "bg-slate-100",
    borderColor: "border-slate-300",
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    shortLabel: "Pending",
    icon: Clock,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
  },
  PARTIALLY_SATISFIED: {
    label: "Partially Satisfied",
    shortLabel: "Partial",
    icon: CheckCircle2,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-400",
  },
  SATISFIED: {
    label: "Satisfied",
    shortLabel: "Satisfied",
    icon: Sparkles,
    color: "text-sky-700",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-400",
  },
  DISPUTED: {
    label: "Disputed",
    shortLabel: "Disputed",
    icon: AlertTriangle,
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-400",
  },
};

export default function CQStatusBadge({
  status,
  size = "md",
  showIcon = true,
}: CQStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: {
      container: "px-2 py-0.5 text-xs",
      icon: "w-3 h-3",
    },
    md: {
      container: "px-3 py-1 text-xs",
      icon: "w-4 h-4",
    },
    lg: {
      container: "px-4 py-1.5 text-sm",
      icon: "w-4 h-4",
    },
  };

  const classes = sizeClasses[size];

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded-lg border font-semibold transition-all
        ${config.color} ${config.bgColor} ${config.borderColor}
        ${classes.container}
      `}
    >
      {showIcon && <Icon className={classes.icon} />}
      <span>{size === "sm" ? config.shortLabel : config.label}</span>
    </div>
  );
}

export function getCQStatusDisplay(status: CQStatusEnum): string {
  return statusConfig[status]?.label || status;
}
