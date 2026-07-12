/**
 * Comprehensive scholar profile with reputation metrics
 */

"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useScholarStats,
  useUserExpertise,
  useReviewerProfile,
} from "@/lib/reputation/hooks";
import { ReputationScore } from "./ReputationScore";
import { ExpertiseDisplay } from "./ExpertiseDisplay";
import { StatsGrid } from "./StatsGrid";
import { ReviewerStats } from "./ReviewerStats";
import { ContributionHistory } from "./ContributionHistory";

interface ScholarProfileProps {
  userId: string;
  userName?: string;
  userImage?: string;
}

export function ScholarProfile({
  userId,
  userName,
  userImage,
}: ScholarProfileProps) {
  const { data: stats, isLoading: statsLoading } = useScholarStats(userId);
  const { data: expertise } = useUserExpertise(userId);
  const { data: reviewerProfile } = useReviewerProfile(userId);

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="w-20 h-20">
              <AvatarImage src={userImage} />
              <AvatarFallback className="text-2xl">
                {(userName || "U")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <h1 className="text-2xl font-bold">
                {userName || stats?.userName || "Scholar"}
              </h1>
              <div className="mt-2 flex items-center gap-4">
                {stats && (
                  <ReputationScore
                    score={stats.reputationScore}
                    size="lg"
                  />
                )}
                <div className="text-sm text-muted-foreground">
                  <span>{stats?.totalArguments || 0} arguments</span>
                  <span className="mx-2">•</span>
                  <span>{stats?.citationCount || 0} citations</span>
                  <span className="mx-2">•</span>
                  <span>{stats?.reviewsCompleted || 0} reviews</span>
                </div>
              </div>
            </div>
          </div>

          {/* Expertise Areas */}
          {expertise && expertise.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Expertise Areas
              </h3>
              <ExpertiseDisplay areas={expertise} compact />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Stats */}
      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
          {reviewerProfile && (
            <TabsTrigger value="reviewer">Reviewer Profile</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="stats" className="mt-4">
          {stats && <StatsGrid stats={stats} />}
        </TabsContent>

        <TabsContent value="contributions" className="mt-4">
          <ContributionHistory userId={userId} />
        </TabsContent>

        {reviewerProfile && (
          <TabsContent value="reviewer" className="mt-4">
            <ReviewerStats profile={reviewerProfile} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
