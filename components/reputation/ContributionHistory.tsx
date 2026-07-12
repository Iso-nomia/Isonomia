/**
 * Timeline of scholar contributions
 */

"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserContributions, useContributionSummary } from "@/lib/reputation/hooks";
import { ContributionType, CONTRIBUTION_WEIGHTS } from "@/lib/reputation/types";
import {
  MessageSquare,
  Swords,
  Shield,
  ThumbsUp,
  BookOpen,
  AlertTriangle,
  Quote,
  CheckCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ContributionHistoryProps {
  userId: string;
  limit?: number;
}

const typeConfig: Record<
  string,
  { icon: React.ReactNode; label: string; color: string }
> = {
  ARGUMENT_CREATED: {
    icon: <MessageSquare className="w-4 h-4" />,
    label: "Created argument",
    color: "bg-blue-100 text-blue-700",
  },
  ATTACK_INITIATED: {
    icon: <Swords className="w-4 h-4" />,
    label: "Initiated attack",
    color: "bg-red-100 text-red-700",
  },
  DEFENSE_PROVIDED: {
    icon: <Shield className="w-4 h-4" />,
    label: "Provided defense",
    color: "bg-green-100 text-green-700",
  },
  SUPPORT_GIVEN: {
    icon: <ThumbsUp className="w-4 h-4" />,
    label: "Supported argument",
    color: "bg-purple-100 text-purple-700",
  },
  REVIEW_COMPLETED: {
    icon: <BookOpen className="w-4 h-4" />,
    label: "Completed review",
    color: "bg-indigo-100 text-indigo-700",
  },
  BLOCKING_CONCERN_RAISED: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: "Raised blocking concern",
    color: "bg-orange-100 text-orange-700",
  },
  CITATION_RECEIVED: {
    icon: <Quote className="w-4 h-4" />,
    label: "Received citation",
    color: "bg-cyan-100 text-cyan-700",
  },
  CONSENSUS_ACHIEVED: {
    icon: <CheckCircle className="w-4 h-4" />,
    label: "Achieved consensus",
    color: "bg-emerald-100 text-emerald-700",
  },
};

export function ContributionHistory({
  userId,
  limit = 20,
}: ContributionHistoryProps) {
  const { data: contributions, isLoading } = useUserContributions(userId, {
    limit,
  });
  const { data: summary } = useContributionSummary(userId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contribution Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.map((item: any) => {
                const config = typeConfig[item.type];
                if (!config) return null;
                return (
                  <Badge
                    key={item.type}
                    variant="outline"
                    className={config.color}
                  >
                    {config.icon}
                    <span className="ml-1">{item.count}</span>
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {contributions?.map((contribution: any) => {
              const config = typeConfig[contribution.type] || {
                icon: <MessageSquare className="w-4 h-4" />,
                label: contribution.type,
                color: "bg-gray-100 text-gray-700",
              };

              return (
                <div
                  key={contribution.id}
                  className="flex items-start gap-3 pb-3 border-b last:border-0"
                >
                  <div className={`p-2 rounded-full ${config.color}`}>
                    {config.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{config.label}</div>
                    {contribution.deliberation && (
                      <div className="text-sm text-muted-foreground truncate">
                        in {contribution.deliberation.title}
                      </div>
                    )}
                    {contribution.argument && (
                      <div className="text-sm text-muted-foreground truncate">
                        &ldquo;{contribution.argument.text}&rdquo;
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(contribution.createdAt), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              );
            })}

            {(!contributions || contributions.length === 0) && (
              <p className="text-center text-muted-foreground py-4">
                No contributions yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
