// components/sources/SourceCrossReferences.tsx
// Phase 3.3: Cross-Deliberation Citation Display
// Shows where a source is cited across multiple deliberations

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { MessageSquare, TrendingUp, Users, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CrossReferencesData {
  source: {
    id: string;
    title: string | null;
    kind: string;
    authors: unknown;
    year: number | null;
    doi: string | null;
    url: string | null;
  };
  contexts: Array<{
    id: string;
    deliberationId: string | null;
    deliberationTitle: string | null;
    argumentId: string | null;
    stackId: string | null;
    intent: string | null;
    quote: string | null;
    note: string | null;
    createdAt: string;
    isPublic: boolean;
  }>;
  byDeliberation: Array<{
    deliberationId: string;
    deliberationTitle: string | null;
    contexts: Array<{
      id: string;
      intent: string | null;
      quote: string | null;
      note: string | null;
      createdAt: string;
    }>;
  }>;
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

interface SourceCrossReferencesProps {
  sourceId: string;
  currentDeliberationId?: string;
  variant?: "compact" | "full";
  className?: string;
}

function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return null;

  const variants: Record<string, { label: string; className: string }> = {
    supports: { label: "Supports", className: "bg-green-100 text-green-700 border-green-300" },
    refutes: { label: "Refutes", className: "bg-red-100 text-red-700 border-red-300" },
    context: { label: "Context", className: "bg-blue-100 text-blue-700 border-blue-300" },
    questions: { label: "Questions", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  };

  const variant = variants[intent] || { label: intent, className: "bg-gray-100 text-gray-700" };

  return (
    <Badge variant="outline" className={cn("text-xs", variant.className)}>
      {variant.label}
    </Badge>
  );
}

function UsageStatBadge({
  icon: Icon,
  value,
  label,
  trend,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  trend?: number;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md">
            <Icon className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-sm font-medium">{value}</span>
            {trend !== undefined && trend > 0 && (
              <span className="text-xs text-green-600">+{trend}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SourceCrossReferences({
  sourceId,
  currentDeliberationId,
  variant = "compact",
  className,
}: SourceCrossReferencesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading, error } = useQuery<CrossReferencesData>({
    queryKey: ["source-cross-refs", sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/sources/${sourceId}/cross-references`);
      if (!res.ok) throw new Error("Failed to fetch cross-references");
      return res.json();
    },
    staleTime: 60000, // Cache for 1 minute
  });

  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  // Filter out current deliberation from display
  const otherDeliberations = data.byDeliberation.filter(
    (d) => d.deliberationId !== currentDeliberationId
  );

  // If no other deliberations, show minimal indicator
  if (otherDeliberations.length === 0) {
    if (!data.usage || data.usage.totalCitations === 0) {
      return null;
    }

    // Show just usage stats if in current context only
    return (
      <div className={cn("flex items-center gap-2 text-sm text-gray-500", className)}>
        <MessageSquare className="h-4 w-4" />
        <span>Cited {data.usage.totalCitations} time{data.usage.totalCitations !== 1 ? "s" : ""}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("border rounded-lg p-3 bg-blue-50/50", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              Also cited in {otherDeliberations.length} other deliberation
              {otherDeliberations.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-2"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-2">
            {otherDeliberations.slice(0, 5).map((delib) => (
              <Link
                key={delib.deliberationId}
                href={`/deliberations/${delib.deliberationId}`}
                className="block p-2 bg-white rounded border hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {delib.deliberationTitle || "Untitled Deliberation"}
                  </span>
                  <div className="flex items-center gap-1">
                    {delib.contexts.some((c) => c.intent === "supports") && (
                      <IntentBadge intent="supports" />
                    )}
                    {delib.contexts.some((c) => c.intent === "refutes") && (
                      <IntentBadge intent="refutes" />
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {delib.contexts.length} citation{delib.contexts.length !== 1 ? "s" : ""}
                </span>
              </Link>
            ))}

            {otherDeliberations.length > 5 && (
              <Link
                href={`/sources/${sourceId}/references`}
                className="block text-sm text-blue-600 hover:underline text-center py-1"
              >
                View all {otherDeliberations.length} deliberations →
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Cross-Platform Usage
          </CardTitle>
          {data.usage && (
            <div className="flex items-center gap-2">
              <UsageStatBadge
                icon={MessageSquare}
                value={data.usage.totalCitations}
                label="Total citations"
                trend={data.usage.citationsLast7Days}
              />
              <UsageStatBadge
                icon={Users}
                value={data.usage.uniqueCiters}
                label="Unique citers"
              />
              {data.usage.trendScore > 50 && (
                <UsageStatBadge
                  icon={TrendingUp}
                  value={Math.round(data.usage.trendScore)}
                  label="Trending score"
                />
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Intent breakdown */}
          {data.usage && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">Intent breakdown:</span>
              <div className="flex gap-2">
                {data.usage.supportCount > 0 && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {data.usage.supportCount} supports
                  </Badge>
                )}
                {data.usage.refuteCount > 0 && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    {data.usage.refuteCount} refutes
                  </Badge>
                )}
                {data.usage.contextCount > 0 && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {data.usage.contextCount} context
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Deliberation list */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">
              Cited in {otherDeliberations.length} deliberation{otherDeliberations.length !== 1 ? "s" : ""}
            </h4>
            {otherDeliberations.map((delib) => (
              <Link
                key={delib.deliberationId}
                href={`/deliberations/${delib.deliberationId}`}
                className="block p-3 bg-gray-50 rounded-lg border hover:border-blue-300 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {delib.deliberationTitle || "Untitled Deliberation"}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-xs text-gray-500">
                      {delib.contexts.length} citation{delib.contexts.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {delib.contexts.map((ctx) => (
                      <IntentBadge key={ctx.id} intent={ctx.intent} />
                    )).filter((_, i) => i < 3)}
                    {delib.contexts.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{delib.contexts.length - 3}
                      </span>
                    )}
                  </div>
                </div>
                {/* Show first quote if available */}
                {delib.contexts[0]?.quote && (
                  <p className="mt-2 text-sm text-gray-600 italic line-clamp-2">
                    "{delib.contexts[0].quote}"
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SourceCrossReferences;
