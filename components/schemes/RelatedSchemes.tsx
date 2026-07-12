/**
 * RelatedSchemes Component
 * 
 * Displays related schemes from the same cluster and related clusters
 * to help users discover connections between schemes.
 * 
 * Week 6, Task 6.4: Related Schemes Navigation
 */

"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import type { ArgumentScheme } from "@prisma/client";
import {
  getRelatedSchemes,
  getClusterForScheme,
  semanticClusters,
} from "@/lib/schemes/semantic-clusters";

interface RelatedSchemesProps {
  currentScheme: ArgumentScheme;
  allSchemes: ArgumentScheme[];
  onSchemeSelect: (scheme: ArgumentScheme) => void;
  onClusterSelect?: (clusterId: string) => void;
  maxSchemes?: number;
  compact?: boolean;
}

export function RelatedSchemes({
  currentScheme,
  allSchemes,
  onSchemeSelect,
  onClusterSelect,
  maxSchemes = 6,
  compact = false,
}: RelatedSchemesProps) {
  const relatedSchemes = getRelatedSchemes(
    currentScheme.key,
    allSchemes,
    maxSchemes
  );

  const currentCluster = getClusterForScheme(currentScheme.key);

  if (relatedSchemes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Related Schemes</h3>
        {currentCluster && onClusterSelect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClusterSelect(currentCluster.id)}
          >
            View all in {currentCluster.name}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {relatedSchemes.map((scheme) => {
          const schemeCluster = getClusterForScheme(scheme.key);
          const isSameCluster =
            schemeCluster?.id === currentCluster?.id;

          return (
            <Card
              key={scheme.id}
              className="p-3 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSchemeSelect(scheme)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {schemeCluster && (
                      <span className="text-lg">{schemeCluster.icon}</span>
                    )}
                    <Badge
                      variant={isSameCluster ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {isSameCluster ? "Same cluster" : schemeCluster?.name}
                    </Badge>
                  </div>

                  <h4 className="font-medium text-sm mb-1">
                    {scheme.name}
                  </h4>

                  {!compact && scheme.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {scheme.summary}
                    </p>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSchemeSelect(scheme);
                  }}
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Related clusters */}
      {currentCluster && currentCluster.relatedClusters.length > 0 && onClusterSelect && (
        <div className="pt-3 border-t">
          <p className="text-sm text-muted-foreground mb-2">
            Also explore:
          </p>
          <div className="flex flex-wrap gap-2">
            {currentCluster.relatedClusters.map((clusterId) => {
              const cluster = semanticClusters[clusterId];
              if (!cluster) return null;

              return (
                <Button
                  key={clusterId}
                  variant="outline"
                  size="sm"
                  onClick={() => onClusterSelect(clusterId)}
                >
                  {cluster.icon} {cluster.name}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
