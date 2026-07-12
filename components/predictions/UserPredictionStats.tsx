// components/predictions/UserPredictionStats.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import {
  TrendingUp,
  Target,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { UserPredictionStats as UserStats } from "@/lib/types/claim-prediction";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface UserPredictionStatsProps {
  userId: string;
  className?: string;
}

export function UserPredictionStats({
  userId,
  className,
}: UserPredictionStatsProps) {
  const { data, error, isLoading } = useSWR<{ ok: boolean; stats: UserStats }>(
    `/api/users/${userId}/prediction-stats`,
    fetcher
  );

  const stats = data?.stats;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return null;
  }

  if (stats.totalPredictions === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Prediction Track Record
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-4">
          <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No predictions made yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate accuracy percentage
  const accuracyPercent = Math.round(stats.accuracyRate * 100);
  const confidencePercent = Math.round(stats.averageConfidence * 100);

  // Determine accuracy rating
  const getAccuracyRating = (accuracy: number) => {
    if (accuracy >= 80) return { label: "Excellent", color: "text-green-600" };
    if (accuracy >= 60) return { label: "Good", color: "text-lime-600" };
    if (accuracy >= 40) return { label: "Average", color: "text-yellow-600" };
    if (accuracy >= 20) return { label: "Poor", color: "text-orange-600" };
    return { label: "Very Poor", color: "text-red-600" };
  };

  const rating = getAccuracyRating(accuracyPercent);
  const hasResolved = stats.confirmedCount + stats.disconfirmedCount > 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Prediction Track Record
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main stats */}
        <div className="grid grid-cols-2 gap-4">
          {/* Accuracy */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Accuracy</span>
            </div>
            {hasResolved ? (
              <div className="flex items-baseline gap-2">
                <span className={cn("text-2xl font-bold", rating.color)}>
                  {accuracyPercent}%
                </span>
                <span className={cn("text-sm", rating.color)}>{rating.label}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No resolved predictions</span>
            )}
          </div>

          {/* Avg Confidence */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Avg Confidence</span>
            </div>
            <span className="text-2xl font-bold">{confidencePercent}%</span>
          </div>
        </div>

        {/* Accuracy progress bar */}
        {hasResolved && (
          <div className="space-y-1">
            <Progress value={accuracyPercent} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {stats.confirmedCount} confirmed out of{" "}
              {stats.confirmedCount + stats.disconfirmedCount} resolved
            </p>
          </div>
        )}

        {/* Breakdown */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
            <Clock className="h-4 w-4 mx-auto text-yellow-600 mb-1" />
            <p className="text-lg font-semibold">{stats.pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>

          <div className="p-2 bg-green-50 rounded border border-green-200">
            <CheckCircle2 className="h-4 w-4 mx-auto text-green-600 mb-1" />
            <p className="text-lg font-semibold">{stats.confirmedCount}</p>
            <p className="text-xs text-muted-foreground">Confirmed</p>
          </div>

          <div className="p-2 bg-red-50 rounded border border-red-200">
            <XCircle className="h-4 w-4 mx-auto text-red-600 mb-1" />
            <p className="text-lg font-semibold">{stats.disconfirmedCount}</p>
            <p className="text-xs text-muted-foreground">Wrong</p>
          </div>

          <div className="p-2 bg-gray-50 rounded border border-gray-200">
            <TrendingUp className="h-4 w-4 mx-auto text-gray-600 mb-1" />
            <p className="text-lg font-semibold">{stats.totalPredictions}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>

        {/* Additional stats if present */}
        {(stats.partiallyTrueCount > 0 ||
          stats.indeterminateCount > 0 ||
          stats.withdrawnCount > 0 ||
          stats.expiredCount > 0) && (
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t">
            {stats.partiallyTrueCount > 0 && (
              <span>{stats.partiallyTrueCount} partially true</span>
            )}
            {stats.indeterminateCount > 0 && (
              <span>{stats.indeterminateCount} indeterminate</span>
            )}
            {stats.withdrawnCount > 0 && (
              <span>{stats.withdrawnCount} withdrawn</span>
            )}
            {stats.expiredCount > 0 && <span>{stats.expiredCount} expired</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UserPredictionStats;
