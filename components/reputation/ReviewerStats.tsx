/**
 * Reviewer-specific statistics display
 */

"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Target,
  BookMarked,
} from "lucide-react";
import { ReviewerProfileSummary } from "@/lib/reputation/types";

interface ReviewerStatsProps {
  profile: ReviewerProfileSummary;
}

export function ReviewerStats({ profile }: ReviewerStatsProps) {
  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <BookMarked className="w-4 h-4" />
              Total Reviews
            </div>
            <div className="text-2xl font-bold mt-1">
              {profile.totalReviews}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-4 h-4" />
              On-Time Rate
            </div>
            <div className="text-2xl font-bold mt-1">
              {Math.round(profile.onTimeRate * 100)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertTriangle className="w-4 h-4" />
              Blocking Concern Rate
            </div>
            <div className="text-2xl font-bold mt-1">
              {Math.round(profile.blockingConcernRate * 100)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Target className="w-4 h-4" />
              Concern Resolution
            </div>
            <div className="text-2xl font-bold mt-1">
              {Math.round(profile.concernResolutionRate * 100)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Average Commitments per Review</span>
              <span className="font-medium">
                {profile.averageCommitments.toFixed(1)}
              </span>
            </div>
            <Progress
              value={Math.min(profile.averageCommitments * 10, 100)}
              className="h-2"
            />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Average Response Time</span>
              <span className="font-medium">
                {profile.averageResponseDays.toFixed(0)} days
              </span>
            </div>
            <Progress
              value={Math.max(0, 100 - profile.averageResponseDays * 5)}
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Specializations */}
      {profile.topSpecialties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Specializations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.topSpecialties.map((specialty, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  {specialty.topicArea}
                  <span className="text-xs bg-primary/20 px-1.5 py-0.5 rounded">
                    {specialty.reviewCount}
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
