/**
 * Phase 3.4.2: Related Sources Component
 * 
 * Displays sources related to the current source
 * based on co-occurrence and topic overlap.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { FileText, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RelatedSourcesProps {
  sourceId: string;
  limit?: number;
  variant?: "compact" | "full";
  className?: string;
}

interface RelatedSource {
  id: string;
  title: string;
  score: number;
  reasons: string[];
}

export function RelatedSources({
  sourceId,
  limit = 5,
  variant = "compact",
  className,
}: RelatedSourcesProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["related-sources", sourceId, limit],
    queryFn: async () => {
      const res = await fetch(`/api/sources/${sourceId}/related?limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch related sources");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className={cn("border rounded-lg p-4", className)}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding related sources...
        </div>
      </div>
    );
  }

  if (error || !data?.sources || data.sources.length === 0) {
    return null;
  }

  const sources = data.sources as RelatedSource[];

  if (variant === "compact") {
    return (
      <div className={cn("border rounded-lg p-4", className)}>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-green-500" />
          Related Sources
        </h4>

        <div className="space-y-2">
          {sources.map((item) => (
            <Link
              key={item.id}
              href={`/sources/${item.id}`}
              className="block p-2 -mx-2 rounded-md hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm line-clamp-2 group-hover:text-green-600">
                    {item.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {item.reasons.join(" · ")}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-green-500 flex-shrink-0 mt-0.5" />
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
          <FileText className="h-5 w-5 text-green-500" />
          Related Sources
        </h4>
        <p className="text-sm text-gray-500 mt-1">
          Sources cited together or with similar topics
        </p>
      </div>

      <div className="divide-y">
        {sources.map((item) => (
          <Link
            key={item.id}
            href={`/sources/${item.id}`}
            className="block p-4 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium group-hover:text-green-600 line-clamp-2">
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
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-green-500 flex-shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default RelatedSources;
