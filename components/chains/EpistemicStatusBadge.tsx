"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EPISTEMIC_STATUS_CONFIG, type EpistemicStatus } from "@/lib/types/argumentChain";
import {
  CheckCircle2,
  HelpCircle,
  GitBranch,
  ArrowRightCircle,
  MessageCircleQuestion,
  XCircle,
  PauseCircle,
  LucideIcon,
} from "lucide-react";

const iconMap: Record<EpistemicStatus, LucideIcon> = {
  ASSERTED: CheckCircle2,
  HYPOTHETICAL: HelpCircle,
  COUNTERFACTUAL: GitBranch,
  CONDITIONAL: ArrowRightCircle,
  QUESTIONED: MessageCircleQuestion,
  DENIED: XCircle,
  SUSPENDED: PauseCircle,
};

interface EpistemicStatusBadgeProps {
  status: EpistemicStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showTooltip?: boolean;
  className?: string;
  onClick?: () => void;
}

export function EpistemicStatusBadge({
  status,
  size = "md",
  showLabel = true,
  showTooltip = true,
  className,
  onClick,
}: EpistemicStatusBadgeProps) {
  const config = EPISTEMIC_STATUS_CONFIG[status];
  const Icon = iconMap[status];

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  const badge = (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        sizeClasses[size],
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        borderWidth: 1,
        borderStyle: config.borderStyle,
        borderColor: config.color,
      }}
      onClick={onClick}
    >
      <Icon size={iconSizes[size]} />
      {showLabel && <span>{config.label}</span>}
    </div>
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

// Compact version for use in node headers
interface EpistemicStatusIconProps {
  status: EpistemicStatus;
  size?: number;
  className?: string;
}

export function EpistemicStatusIcon({
  status,
  size = 14,
  className,
}: EpistemicStatusIconProps) {
  const config = EPISTEMIC_STATUS_CONFIG[status];
  const Icon = iconMap[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon
            size={size}
            className={cn("shrink-0", className)}
            style={{ color: config.color }}
          />
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Dropdown selector for epistemic status
interface EpistemicStatusSelectorProps {
  value: EpistemicStatus;
  onChange: (status: EpistemicStatus) => void;
  disabled?: boolean;
  className?: string;
}

export function EpistemicStatusSelector({
  value,
  onChange,
  disabled,
  className,
}: EpistemicStatusSelectorProps) {
  const statuses: EpistemicStatus[] = [
    "ASSERTED",
    "HYPOTHETICAL",
    "COUNTERFACTUAL",
    "CONDITIONAL",
    "QUESTIONED",
    "DENIED",
    "SUSPENDED",
  ];

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {statuses.map((status) => {
        const isSelected = status === value;
        const config = EPISTEMIC_STATUS_CONFIG[status];
        const Icon = iconMap[status];

        return (
          <TooltipProvider key={status}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(status)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
                    "border transition-all",
                    isSelected
                      ? "ring-2 ring-offset-1"
                      : "opacity-60 hover:opacity-100",
                    disabled && "opacity-40 cursor-not-allowed"
                  )}
                  style={{
                    backgroundColor: isSelected ? config.bgColor : "transparent",
                    color: config.color,
                    borderColor: config.color,
                    borderStyle: config.borderStyle,
                    ...(isSelected && { ringColor: config.color }),
                  }}
                >
                  <Icon size={12} />
                  <span className="hidden sm:inline">{config.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-medium">{config.label}</p>
                <p className="text-xs text-muted-foreground">
                  {config.description}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

export default EpistemicStatusBadge;
