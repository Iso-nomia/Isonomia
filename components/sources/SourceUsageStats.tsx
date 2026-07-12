// components/sources/SourceUsageStats.tsx
// Phase 3.3: Source Usage Statistics Display
// Shows aggregated usage metrics for a source

"use client";

import { useQuery } from "@tanstack/react-query";
import { 
  MessageSquare, 
  Users, 
  TrendingUp, 
  Calendar,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Layers,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface SourceUsageData {
  usage: {
    totalCitations: number;
    deliberationCount: number;
    argumentCount: number;
    stackCount: number;
    uniqueCiters: number;
    supportCount: number;
    refuteCount: number;
    contextCount: number;
    citationsLast7Days: number;
    citationsLast30Days: number;
    trendScore: number;
    firstCitedAt: string | null;
    lastCitedAt: string | null;
  } | null;
}

interface SourceUsageStatsProps {
  sourceId: string;
  variant?: "compact" | "card" | "inline";
  className?: string;
}

function StatItem({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="p-2 bg-gray-100 rounded-lg">
        <Icon className="h-4 w-4 text-gray-600" />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-semibold">{value}</span>
          {trend === "up" && (
            <TrendingUp className="h-4 w-4 text-green-500" />
          )}
        </div>
        <span className="text-xs text-gray-500">{label}</span>
        {subValue && (
          <span className="text-xs text-gray-400 block">{subValue}</span>
        )}
      </div>
    </div>
  );
}

function IntentBar({
  supports,
  refutes,
  context,
  total,
}: {
  supports: number;
  refutes: number;
  context: number;
  total: number;
}) {
  if (total === 0) return null;

  const supportPct = (supports / total) * 100;
  const refutePct = (refutes / total) * 100;
  const contextPct = (context / total) * 100;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex">
            {supportPct > 0 && (
              <div
                className="h-full bg-green-400"
                style={{ width: `${supportPct}%` }}
              />
            )}
            {refutePct > 0 && (
              <div
                className="h-full bg-red-400"
                style={{ width: `${refutePct}%` }}
              />
            )}
            {contextPct > 0 && (
              <div
                className="h-full bg-blue-400"
                style={{ width: `${contextPct}%` }}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span>Supports: {supports} ({Math.round(supportPct)}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-400 rounded-full" />
              <span>Refutes: {refutes} ({Math.round(refutePct)}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full" />
              <span>Context: {context} ({Math.round(contextPct)}%)</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SourceUsageStats({
  sourceId,
  variant = "card",
  className,
}: SourceUsageStatsProps) {
  const { data, isLoading } = useQuery<SourceUsageData>({
    queryKey: ["source-usage", sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/sources/${sourceId}/cross-references`);
      if (!res.ok) throw new Error("Failed to fetch usage stats");
      return res.json();
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return <Skeleton className={cn("h-32 rounded-lg", className)} />;
  }

  if (!data?.usage) {
    return null;
  }

  const { usage } = data;

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-4 text-sm", className)}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-gray-600">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{usage.totalCitations}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Total citations</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-gray-600">
                <Layers className="h-3.5 w-3.5" />
                <span>{usage.deliberationCount}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Deliberations</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-gray-600">
                <Users className="h-3.5 w-3.5" />
                <span>{usage.uniqueCiters}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Unique citers</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {usage.trendScore > 50 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Trending</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                High recent activity (score: {Math.round(usage.trendScore)})
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("p-3 bg-gray-50 rounded-lg", className)}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Usage Stats</span>
          {usage.trendScore > 50 && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Trending
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-semibold">{usage.totalCitations}</div>
            <div className="text-xs text-gray-500">Citations</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{usage.deliberationCount}</div>
            <div className="text-xs text-gray-500">Debates</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{usage.uniqueCiters}</div>
            <div className="text-xs text-gray-500">Citers</div>
          </div>
        </div>
        <div className="mt-3">
          <IntentBar
            supports={usage.supportCount}
            refutes={usage.refuteCount}
            context={usage.contextCount}
            total={usage.totalCitations}
          />
        </div>
      </div>
    );
  }

  // Full card variant
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Usage Analytics</CardTitle>
          {usage.trendScore > 50 && (
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <TrendingUp className="h-4 w-4" />
              <span>Trending</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatItem
            icon={MessageSquare}
            label="Total Citations"
            value={usage.totalCitations}
            subValue={usage.citationsLast7Days > 0 ? `+${usage.citationsLast7Days} this week` : undefined}
            trend={usage.citationsLast7Days > 0 ? "up" : "neutral"}
          />
          <StatItem
            icon={Layers}
            label="Deliberations"
            value={usage.deliberationCount}
          />
          <StatItem
            icon={FileText}
            label="Arguments"
            value={usage.argumentCount}
          />
          <StatItem
            icon={Users}
            label="Unique Citers"
            value={usage.uniqueCiters}
          />
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-medium mb-2">Citation Intent</h4>
          <IntentBar
            supports={usage.supportCount}
            refutes={usage.refuteCount}
            context={usage.contextCount}
            total={usage.totalCitations}
          />
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3 text-green-500" />
              <span>{usage.supportCount} supports</span>
            </div>
            <div className="flex items-center gap-1">
              <ThumbsDown className="h-3 w-3 text-red-500" />
              <span>{usage.refuteCount} refutes</span>
            </div>
            <div className="flex items-center gap-1">
              <HelpCircle className="h-3 w-3 text-blue-500" />
              <span>{usage.contextCount} context</span>
            </div>
          </div>
        </div>

        {(usage.firstCitedAt || usage.lastCitedAt) && (
          <div className="mt-6 pt-4 border-t flex justify-between text-xs text-gray-500">
            {usage.firstCitedAt && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>
                  First cited {formatDistanceToNow(new Date(usage.firstCitedAt), { addSuffix: true })}
                </span>
              </div>
            )}
            {usage.lastCitedAt && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>
                  Last cited {formatDistanceToNow(new Date(usage.lastCitedAt), { addSuffix: true })}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SourceUsageStats;
