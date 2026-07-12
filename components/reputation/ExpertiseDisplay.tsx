/**
 * Display scholar expertise areas
 */

"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpertiseAreaSummary, ExpertiseLevel } from "@/lib/reputation/types";
import { cn } from "@/lib/utils";
import { Award, Star, BookOpen, GraduationCap, Sparkles } from "lucide-react";

interface ExpertiseDisplayProps {
  areas: ExpertiseAreaSummary[];
  compact?: boolean;
}

const levelConfig: Record<
  ExpertiseLevel,
  { icon: React.ReactNode; color: string; bg: string }
> = {
  NOVICE: {
    icon: <Sparkles className="w-3 h-3" />,
    color: "text-gray-600",
    bg: "bg-gray-100",
  },
  CONTRIBUTOR: {
    icon: <BookOpen className="w-3 h-3" />,
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  ESTABLISHED: {
    icon: <Star className="w-3 h-3" />,
    color: "text-green-600",
    bg: "bg-green-100",
  },
  EXPERT: {
    icon: <GraduationCap className="w-3 h-3" />,
    color: "text-purple-600",
    bg: "bg-purple-100",
  },
  AUTHORITY: {
    icon: <Award className="w-3 h-3" />,
    color: "text-yellow-600",
    bg: "bg-yellow-100",
  },
};

export function ExpertiseDisplay({ areas, compact }: ExpertiseDisplayProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {areas.slice(0, 5).map((area, index) => {
          const config = levelConfig[area.expertiseLevel];
          return (
            <Badge
              key={index}
              variant="outline"
              className={cn("gap-1", config.bg, config.color)}
            >
              {config.icon}
              {area.topicArea}
            </Badge>
          );
        })}
        {areas.length > 5 && (
          <Badge variant="outline" className="text-muted-foreground">
            +{areas.length - 5} more
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Expertise Areas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {areas.map((area, index) => {
          const config = levelConfig[area.expertiseLevel];
          return (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-full", config.bg, config.color)}>
                  {config.icon}
                </div>
                <div>
                  <div className="font-medium">
                    {area.topicArea}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {area.contributionCount} contributions
                  </div>
                </div>
              </div>

              <Badge className={cn(config.bg, config.color)} variant="outline">
                {area.expertiseLevel.charAt(0) +
                  area.expertiseLevel.slice(1).toLowerCase()}
              </Badge>
            </div>
          );
        })}

        {areas.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            No expertise areas yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}
