/**
 * Grid display of scholar statistics
 */

"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare,
  Swords,
  Shield,
  Target,
  BookOpen,
  Quote,
  Users,
  TrendingUp,
} from "lucide-react";
import { ScholarStatsSummary } from "@/lib/reputation/types";

interface StatsGridProps {
  stats: ScholarStatsSummary;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const statCards = [
    {
      icon: <MessageSquare className="w-5 h-5 text-blue-500" />,
      label: "Arguments Created",
      value: stats.totalArguments,
      subValue: `${stats.argumentsWithConsensus} reached consensus`,
      progress: stats.consensusRate * 100,
      progressLabel: "Consensus Rate",
    },
    {
      icon: <Swords className="w-5 h-5 text-red-500" />,
      label: "Attacks Initiated",
      value: stats.totalAttacks,
      subValue: `${stats.successfulAttacks} successful`,
      progress: stats.attackPrecision * 100,
      progressLabel: "Attack Precision",
    },
    {
      icon: <Shield className="w-5 h-5 text-green-500" />,
      label: "Defenses Provided",
      value: stats.totalDefenses,
      subValue: `${stats.successfulDefenses} held`,
      progress: stats.defenseSuccessRate * 100,
      progressLabel: "Defense Success",
    },
    {
      icon: <BookOpen className="w-5 h-5 text-purple-500" />,
      label: "Reviews Completed",
      value: stats.reviewsCompleted,
      progress: stats.reviewQuality,
      progressLabel: "Review Quality",
    },
    {
      icon: <Quote className="w-5 h-5 text-orange-500" />,
      label: "Citations Received",
      value: stats.citationCount,
    },
    {
      icon: <Users className="w-5 h-5 text-cyan-500" />,
      label: "Downstream Usage",
      value: stats.downstreamUsage,
      subValue: "Arguments built on yours",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {statCards.map((card, index) => (
        <Card key={index}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-3">
              {card.icon}
              <span className="text-sm font-medium text-muted-foreground">
                {card.label}
              </span>
            </div>

            <div className="text-3xl font-bold">{card.value}</div>

            {card.subValue && (
              <div className="text-sm text-muted-foreground mt-1">
                {card.subValue}
              </div>
            )}

            {card.progress !== undefined && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {card.progressLabel}
                  </span>
                  <span>{Math.round(card.progress)}%</span>
                </div>
                <Progress value={card.progress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
