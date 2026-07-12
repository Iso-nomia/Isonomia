// components/predictions/PredictionCard.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Calendar,
  TrendingUp,
  MoreVertical,
  Trash2,
  Edit,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ClaimPrediction } from "@/lib/types/claim-prediction";

// Status configuration
const statusConfig = {
  PENDING: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: Clock,
  },
  RESOLVED: {
    label: "Resolved",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: CheckCircle2,
  },
  WITHDRAWN: {
    label: "Withdrawn",
    color: "bg-gray-100 text-gray-600 border-gray-300",
    icon: Trash2,
  },
  EXPIRED: {
    label: "Expired",
    color: "bg-orange-100 text-orange-800 border-orange-300",
    icon: AlertTriangle,
  },
};

// Resolution configuration
const resolutionConfig = {
  CONFIRMED: {
    label: "Confirmed",
    color: "bg-green-100 text-green-800 border-green-300",
    icon: CheckCircle2,
  },
  DISCONFIRMED: {
    label: "Wrong",
    color: "bg-red-100 text-red-800 border-red-300",
    icon: XCircle,
  },
  PARTIALLY_TRUE: {
    label: "Partial",
    color: "bg-amber-100 text-amber-800 border-amber-300",
    icon: HelpCircle,
  },
  INDETERMINATE: {
    label: "Indeterminate",
    color: "bg-gray-100 text-gray-600 border-gray-300",
    icon: HelpCircle,
  },
};

interface PredictionCardProps {
  prediction: ClaimPrediction;
  currentUserId?: string;
  onUpdate?: () => void;
  onResolve?: (predictionId: string) => void;
  onRecordOutcome?: (predictionId: string) => void;
  onEdit?: (predictionId: string) => void;
  onDelete?: (predictionId: string) => void;
}

export function PredictionCard({
  prediction,
  currentUserId,
  onUpdate,
  onResolve,
  onRecordOutcome,
  onEdit,
  onDelete,
}: PredictionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isOwner = currentUserId && prediction.createdById === currentUserId;
  const isPending = prediction.status === "PENDING";
  const isResolved = prediction.status === "RESOLVED";

  const StatusIcon = statusConfig[prediction.status as keyof typeof statusConfig]?.icon || Clock;
  const statusStyle = statusConfig[prediction.status as keyof typeof statusConfig];

  // Format confidence as percentage
  const confidencePercent = Math.round(prediction.confidence * 100);

  // Format dates
  const createdDate = new Date(prediction.createdAt).toLocaleDateString();
  const targetDate = prediction.targetDate
    ? new Date(prediction.targetDate).toLocaleDateString()
    : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Main content - clickable to expand */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            {/* Prediction text and metadata */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-relaxed">
                {prediction.predictionText}
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                {/* Confidence */}
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {confidencePercent}% confident
                </span>

                {/* Target date */}
                {targetDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Target: {targetDate}
                  </span>
                )}

                {/* Created date */}
                <span>Created {createdDate}</span>

                {/* Outcome count */}
                {prediction.outcomes && prediction.outcomes.length > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {prediction.outcomes.length} outcome{prediction.outcomes.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Status badge and expand icon */}
            <div className="flex items-center gap-2">
              {/* Resolution badge if resolved */}
              {isResolved && prediction.resolution && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    resolutionConfig[prediction.resolution as keyof typeof resolutionConfig]?.color
                  )}
                >
                  {resolutionConfig[prediction.resolution as keyof typeof resolutionConfig]?.label}
                </Badge>
              )}

              {/* Status badge */}
              <Badge variant="outline" className={cn("text-xs", statusStyle?.color)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusStyle?.label}
              </Badge>

              {/* Expand/collapse icon */}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </button>

        {/* Expanded section */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t bg-muted/30">
            {/* Outcomes list */}
            {prediction.outcomes && prediction.outcomes.length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                  Recorded Outcomes
                </h4>
                <div className="space-y-2">
                  {prediction.outcomes.map((outcome) => (
                    <div
                      key={outcome.id}
                      className="text-sm p-2 bg-background rounded border"
                    >
                      <p>{outcome.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{outcome.evidenceType}</span>
                        {outcome.evidenceUrl && (
                          <a
                            href={outcome.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View source
                          </a>
                        )}
                        <span>
                          {new Date(outcome.observedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution note */}
            {isResolved && prediction.resolutionNote && (
              <div className="mt-3">
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">
                  Resolution Note
                </h4>
                <p className="text-sm text-muted-foreground">
                  {prediction.resolutionNote}
                </p>
              </div>
            )}

            {/* Actions */}
            {isPending && (
              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRecordOutcome?.(prediction.id);
                  }}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Record Outcome
                </Button>

                <Button
                  size="sm"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve?.(prediction.id);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Resolve
                </Button>

                {/* Owner actions */}
                {isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(prediction.id)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete?.(prediction.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Withdraw
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PredictionCard;
