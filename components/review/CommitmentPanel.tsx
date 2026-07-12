/**
 * Panel showing reviewer commitments (concerns/questions/required changes)
 */

"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  FileEdit,
  ChevronDown,
  ChevronUp,
  Check,
  RotateCcw,
} from "lucide-react";
import { useResolveCommitment, useReopenCommitment } from "@/lib/review/hooks";

interface Commitment {
  id: string;
  reviewerAssignmentId: string;
  type: "CONCERN" | "QUESTION" | "REQUIRED_CHANGE" | "SUGGESTION";
  content: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  resolved: boolean;
  resolutionNote?: string;
  resolvedAt?: string;
  createdAt: string;
  reviewer?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface CommitmentPanelProps {
  reviewId: string;
  commitments: Commitment[];
  showOnlyUnresolved?: boolean;
}

const typeConfig: Record<
  Commitment["type"],
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  CONCERN: {
    icon: AlertTriangle,
    color: "text-orange-500",
    label: "Concern",
  },
  QUESTION: {
    icon: HelpCircle,
    color: "text-blue-500",
    label: "Question",
  },
  REQUIRED_CHANGE: {
    icon: FileEdit,
    color: "text-red-500",
    label: "Required Change",
  },
  SUGGESTION: {
    icon: CheckCircle,
    color: "text-green-500",
    label: "Suggestion",
  },
};

const severityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export function CommitmentPanel({
  reviewId,
  commitments,
  showOnlyUnresolved = false,
}: CommitmentPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showResolved, setShowResolved] = useState(!showOnlyUnresolved);

  const resolveCommitment = useResolveCommitment(reviewId);
  const reopenCommitment = useReopenCommitment(reviewId);

  const filteredCommitments = commitments.filter(
    (c) => showResolved || !c.resolved
  );
  const unresolvedCount = commitments.filter((c) => !c.resolved).length;
  const resolvedCount = commitments.filter((c) => c.resolved).length;

  const handleResolve = async (commitmentId: string) => {
    try {
      await resolveCommitment.mutateAsync({
        commitmentId,
        resolutionNote: "Resolved",
      });
    } catch (error) {
      console.error("Failed to resolve commitment:", error);
    }
  };

  const handleReopen = async (commitmentId: string) => {
    try {
      await reopenCommitment.mutateAsync(commitmentId);
    } catch (error) {
      console.error("Failed to reopen commitment:", error);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">Reviewer Commitments</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {unresolvedCount} open, {resolvedCount} resolved
          </p>
        </div>
        {showOnlyUnresolved && resolvedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowResolved(!showResolved)}
          >
            {showResolved ? "Hide Resolved" : "Show Resolved"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {filteredCommitments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {showResolved
              ? "No commitments yet"
              : "No unresolved commitments"}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredCommitments.map((commitment) => {
              const config = typeConfig[commitment.type];
              const TypeIcon = config.icon;
              const isExpanded = expanded[commitment.id];

              return (
                <div
                  key={commitment.id}
                  className={`border rounded-lg p-3 ${
                    commitment.resolved ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <TypeIcon className={`w-5 h-5 mt-0.5 ${config.color}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={config.color}>
                          {config.label}
                        </Badge>
                        {commitment.severity && (
                          <Badge
                            variant="secondary"
                            className={severityColors[commitment.severity]}
                          >
                            {commitment.severity}
                          </Badge>
                        )}
                        {commitment.resolved && (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-700"
                          >
                            Resolved
                          </Badge>
                        )}
                      </div>

                      <p
                        className={`mt-2 text-sm ${
                          isExpanded ? "" : "line-clamp-2"
                        }`}
                      >
                        {commitment.content}
                      </p>

                      {commitment.content.length > 150 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-6 px-2"
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [commitment.id]: !isExpanded,
                            }))
                          }
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3 mr-1" />
                              Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3 mr-1" />
                              More
                            </>
                          )}
                        </Button>
                      )}

                      {commitment.resolved && commitment.resolutionNote && (
                        <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                          <span className="font-medium">Resolution:</span>{" "}
                          {commitment.resolutionNote}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          {commitment.reviewer && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                                    {commitment.reviewer.name
                                      ?.split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .toUpperCase() || "R"}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {commitment.reviewer.name ||
                                    commitment.reviewer.email}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(commitment.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {!commitment.resolved ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => handleResolve(commitment.id)}
                            disabled={resolveCommitment.isPending}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Resolve
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => handleReopen(commitment.id)}
                            disabled={reopenCommitment.isPending}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reopen
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
