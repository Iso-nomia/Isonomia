// components/aif/CommitmentBadge.tsx
"use client";
import { Badge } from "@/components/ui/badge";
import { Users, CheckCircle2, XCircle } from "lucide-react";
import type { CommitmentIndicator } from "@/lib/aif/commitment-helpers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CommitmentBadgeProps {
  indicator: CommitmentIndicator;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "compact";
  className?: string;
}

/**
 * CommitmentBadge Component
 * 
 * Visual indicator showing commitment status for a claim node.
 * Displays count of participants who have committed to this claim.
 * 
 * Variants:
 * - default: Shows icon + count with tooltip
 * - compact: Just the count badge
 * 
 * Usage on graph nodes:
 * ```tsx
 * {node.commitmentIndicator && (
 *   <CommitmentBadge indicator={node.commitmentIndicator} size="sm" />
 * )}
 * ```
 */
export function CommitmentBadge({
  indicator,
  size = "md",
  variant = "default",
  className = ""
}: CommitmentBadgeProps) {
  const hasActiveCommitments = indicator.totalActive > 0;
  const hasRetractions = indicator.totalRetracted > 0;

  const sizeClasses = {
    sm: "text-[10px] px-1 py-0.5",
    md: "text-xs px-2 py-1",
    lg: "text-sm px-3 py-1.5"
  };

  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={hasActiveCommitments ? "default" : "secondary"}
              className={`${sizeClasses[size]} ${className}`}
            >
              <Users className="w-3 h-3 mr-1" />
              {indicator.participantCount}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <div className="font-semibold">
                {indicator.participantCount} participant{indicator.participantCount !== 1 ? "s" : ""} committed
              </div>
              {hasActiveCommitments && (
                <div className="text-green-600">
                  ✓ {indicator.totalActive} active
                </div>
              )}
              {hasRetractions && (
                <div className="text-red-600">
                  ✗ {indicator.totalRetracted} retracted
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Default variant with detailed tooltip
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1 ${className}`}>
            <Badge
              variant={hasActiveCommitments ? "default" : "secondary"}
              className={sizeClasses[size]}
            >
              <Users className="w-3 h-3 mr-1" />
              {indicator.participantCount}
            </Badge>
            {hasActiveCommitments && (
              <CheckCircle2 className="w-3 h-3 text-green-600" />
            )}
            {hasRetractions && (
              <XCircle className="w-3 h-3 text-red-400" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold text-sm border-b pb-1">
              Commitment Status
            </div>
            
            <div className="space-y-1">
              <div className="text-xs text-gray-500">
                {indicator.participantCount} participant{indicator.participantCount !== 1 ? "s" : ""} total
              </div>
              
              {hasActiveCommitments && (
                <div className="text-xs flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{indicator.totalActive} active commitment{indicator.totalActive !== 1 ? "s" : ""}</span>
                </div>
              )}
              
              {hasRetractions && (
                <div className="text-xs flex items-center gap-1 text-red-500">
                  <XCircle className="w-3 h-3" />
                  <span>{indicator.totalRetracted} retraction{indicator.totalRetracted !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>

            <div className="border-t pt-2 space-y-1">
              <div className="text-xs font-medium">Participants:</div>
              {indicator.participants.map(participant => (
                <div
                  key={participant.id}
                  className="text-xs flex items-center gap-1"
                >
                  {participant.isActive ? (
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-gray-400" />
                  )}
                  <span className={participant.isActive ? "" : "line-through text-gray-500"}>
                    {participant.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline commitment count badge (for use in node rendering)
 * Minimal variant that doesn't require tooltip provider
 */
export function InlineCommitmentCount({
  count,
  isActive = true,
  className = ""
}: {
  count: number;
  isActive?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
        isActive 
          ? "bg-blue-100 text-blue-700 border border-blue-200" 
          : "bg-gray-100 text-gray-500 border border-gray-200"
      } ${className}`}
      title={`${count} participant${count !== 1 ? "s" : ""} committed`}
    >
      <Users className="w-2.5 h-2.5" />
      {count}
    </span>
  );
}
