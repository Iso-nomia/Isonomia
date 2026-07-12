/**
 * Phase 3.4.2: Related Deliberations Component
 * 
 * Displays deliberations related to the current one
 * based on shared sources and topic overlap.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { MessageSquare, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RelatedDeliberationsProps {
  deliberationId: string;
  limit?: number;
  variant?: "compact" | "full";
  className?: string;
}

interface RelatedDeliberation {
  id: string;
  type: "deliberation";
  title: string;
  score: number;
  reasons: string[];
  metadata?: {
    sharedSources?: number;
    sharedTopics?: number;
  };
}

export function RelatedDeliberations({
  deliberationId,
  limit = 5,
  variant = "compact",
  className,
}: RelatedDeliberationsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["related-deliberations", deliberationId, limit],
    queryFn: async () => {
      const res = await fetch(
        `/api/deliberations/${deliberationId}/related?limit=${limit}`
      );
      if (!res.ok) throw new Error("Failed to fetch related deliberations");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (isLoading) {
    return (
      <div className={cn("border rounded-lg p-4", className)}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding related discussions...
        </div>
      </div>
    );
  }

  if (error || !data?.deliberations || data.deliberations.length === 0) {
    return null;
  }

  const deliberations = data.deliberations as RelatedDeliberation[];

  if (variant === "compact") {
    return (
      <div className={cn("border rounded-lg p-4", className)}>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-purple-500" />
          Related Deliberations
        </h4>

        <div className="space-y-2">
          {deliberations.map((item) => (
            <Link
              key={item.id}
              href={`/deliberations/${item.id}`}
              className="block p-2 -mx-2 rounded-md hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm line-clamp-1 group-hover:text-purple-600">
                    {item.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-1">
                    {item.reasons.map((reason, i) => (
                      <span key={i} className="bg-gray-100 px-1.5 py-0.5 rounded">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-purple-500 flex-shrink-0 mt-0.5" />
              </div>
            </Link>
          ))}
        </div>

        {data.count >= limit && (
          <Link
            href={`/deliberations/${deliberationId}/related`}
            className="text-xs text-purple-600 hover:underline mt-3 inline-block"
          >
            View all related →
          </Link>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn("border rounded-lg", className)}>
      <div className="p-4 border-b bg-gray-50">
        <h4 className="font-medium flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-500" />
          Related Deliberations
        </h4>
        <p className="text-sm text-gray-500 mt-1">
          Discussions with similar sources or topics
        </p>
      </div>

      <div className="divide-y">
        {deliberations.map((item) => (
          <Link
            key={item.id}
            href={`/deliberations/${item.id}`}
            className="block p-4 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium group-hover:text-purple-600">
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
              <div className="text-right text-xs text-gray-400">
                <div>Score: {item.score}</div>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-purple-500 mt-1 ml-auto" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default RelatedDeliberations;
