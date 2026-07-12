/**
 * Phase 3.4.2: Related Stacks Component
 * 
 * Displays stacks related to the current deliberation
 * based on shared sources.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Layers, ArrowRight, Loader2, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

interface RelatedStacksProps {
  deliberationId: string;
  limit?: number;
  variant?: "compact" | "full";
  className?: string;
}

interface RelatedStack {
  id: string;
  type: "stack";
  title: string;
  score: number;
  reasons: string[];
  metadata?: {
    sharedSources?: number;
    overlapRatio?: number;
  };
}

export function RelatedStacks({
  deliberationId,
  limit = 5,
  variant = "compact",
  className,
}: RelatedStacksProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["related-stacks", deliberationId, limit],
    queryFn: async () => {
      const res = await fetch(
        `/api/deliberations/${deliberationId}/related-stacks?limit=${limit}`
      );
      if (!res.ok) throw new Error("Failed to fetch related stacks");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (isLoading) {
    return (
      <div className={cn("border rounded-lg p-4", className)}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding related stacks...
        </div>
      </div>
    );
  }

  if (error || !data?.stacks || data.stacks.length === 0) {
    return null;
  }

  const stacks = data.stacks as RelatedStack[];

  if (variant === "compact") {
    return (
      <div className={cn("border rounded-lg p-4", className)}>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-blue-500" />
          Related Evidence Stacks
        </h4>

        <div className="space-y-2">
          {stacks.map((item) => (
            <Link
              key={item.id}
              href={`/stacks/${item.id}`}
              className="block p-2 -mx-2 rounded-md hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm line-clamp-1 group-hover:text-blue-600">
                    {item.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {item.reasons.join(" · ")}
                  </div>
                </div>
                {item.metadata?.overlapRatio !== undefined && item.metadata.overlapRatio >= 0.3 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Percent className="h-3 w-3" />
                    {Math.round(item.metadata.overlapRatio * 100)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn("border rounded-lg", className)}>
      <div className="p-4 border-b bg-gray-50">
        <h4 className="font-medium flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-500" />
          Related Evidence Stacks
        </h4>
        <p className="text-sm text-gray-500 mt-1">
          Curated collections with overlapping sources
        </p>
      </div>

      <div className="divide-y">
        {stacks.map((item) => (
          <Link
            key={item.id}
            href={`/stacks/${item.id}`}
            className="block p-4 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium group-hover:text-blue-600">
                  {item.title}
                </div>
                <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-2">
                  {item.reasons.map((reason, i) => (
                    <span key={i} className="bg-gray-100 px-2 py-0.5 rounded-full text-xs">
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.metadata?.overlapRatio !== undefined && (
                  <div className="text-right">
                    <div className="text-lg font-semibold text-blue-600">
                      {Math.round(item.metadata.overlapRatio * 100)}%
                    </div>
                    <div className="text-xs text-gray-400">overlap</div>
                  </div>
                )}
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default RelatedStacks;
