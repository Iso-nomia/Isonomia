/**
 * Panel showing reviewer assignments and their status
 */

"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InviteReviewerDialog } from "./InviteReviewerDialog";
import { Check, Clock, X, Mail } from "lucide-react";

interface Assignment {
  id: string;
  reviewerId: string;
  reviewer: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  role: "PRIMARY" | "SECONDARY" | "EDITOR" | "EXTERNAL";
  status: "INVITED" | "ACCEPTED" | "DECLINED" | "COMPLETED";
  invitedAt: string;
  respondedAt?: string;
  completedAt?: string;
}

interface ReviewerPanelProps {
  reviewId: string;
  assignments: Assignment[];
}

const statusConfig: Record<
  Assignment["status"],
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  INVITED: {
    icon: Mail,
    color: "text-yellow-500",
    label: "Invited",
  },
  ACCEPTED: {
    icon: Check,
    color: "text-blue-500",
    label: "Accepted",
  },
  DECLINED: {
    icon: X,
    color: "text-red-500",
    label: "Declined",
  },
  COMPLETED: {
    icon: Check,
    color: "text-green-500",
    label: "Completed",
  },
};

const roleLabels: Record<Assignment["role"], string> = {
  PRIMARY: "Primary",
  SECONDARY: "Secondary",
  EDITOR: "Editor",
  EXTERNAL: "External",
};

const roleBadgeColors: Record<Assignment["role"], string> = {
  PRIMARY: "bg-blue-100 text-blue-800",
  SECONDARY: "bg-purple-100 text-purple-800",
  EDITOR: "bg-green-100 text-green-800",
  EXTERNAL: "bg-orange-100 text-orange-800",
};

export function ReviewerPanel({ reviewId, assignments }: ReviewerPanelProps) {
  const acceptedCount = assignments.filter((a) => a.status === "ACCEPTED").length;
  const pendingCount = assignments.filter((a) => a.status === "INVITED").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">Reviewers</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {acceptedCount} accepted, {pendingCount} pending
          </p>
        </div>
        <InviteReviewerDialog reviewId={reviewId} />
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No reviewers assigned yet
          </p>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const config = statusConfig[assignment.status];
              const StatusIcon = config.icon;

              return (
                <div
                  key={assignment.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {assignment.reviewer.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() || "R"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {assignment.reviewer.name || assignment.reviewer.email}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={roleBadgeColors[assignment.role]}
                      >
                        {roleLabels[assignment.role]}
                      </Badge>
                      <span
                        className={`flex items-center gap-1 text-xs ${config.color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </span>
                    </div>
                  </div>

                  {assignment.respondedAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(assignment.respondedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
