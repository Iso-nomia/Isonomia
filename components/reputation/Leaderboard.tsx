/**
 * Reputation leaderboard display
 */

"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useReputationLeaderboard } from "@/lib/reputation/hooks";
import { ReputationBadge } from "./ReputationScore";
import { Trophy, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardProps {
  limit?: number;
  title?: string;
}

const rankIcons: Record<number, React.ReactNode> = {
  1: <Trophy className="w-5 h-5 text-yellow-500" />,
  2: <Medal className="w-5 h-5 text-gray-400" />,
  3: <Award className="w-5 h-5 text-orange-600" />,
};

export function Leaderboard({
  limit = 10,
  title = "Top Scholars",
}: LeaderboardProps) {
  const { data: leaderboard, isLoading } = useReputationLeaderboard({
    limit,
  });

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {leaderboard?.map((entry: any) => (
          <div
            key={entry.userId}
            className={cn(
              "flex items-center gap-4 p-3 rounded-lg",
              entry.rank <= 3 ? "bg-muted" : "hover:bg-muted/50"
            )}
          >
            {/* Rank */}
            <div className="w-8 flex justify-center">
              {rankIcons[entry.rank] || (
                <span className="text-lg font-bold text-muted-foreground">
                  {entry.rank}
                </span>
              )}
            </div>

            {/* User */}
            <Avatar className="w-10 h-10">
              <AvatarImage src={entry.userImage} />
              <AvatarFallback>
                {entry.userName
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{entry.userName}</div>
              <div className="text-xs text-muted-foreground">
                {entry.totalArguments} arguments •{" "}
                {Math.round(entry.consensusRate * 100)}% consensus
              </div>
            </div>

            {/* Score */}
            <ReputationBadge score={entry.reputationScore} />
          </div>
        ))}

        {(!leaderboard || leaderboard.length === 0) && (
          <p className="text-center text-muted-foreground py-4">
            No scholars found
          </p>
        )}
      </CardContent>
    </Card>
  );
}
