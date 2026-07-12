/**
 * ClusterSchemeList Component
 * 
 * Displays all schemes within a selected semantic cluster
 * with expandable details and selection functionality.
 * 
 * Week 6, Task 6.3: Scheme List View
 */

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArgumentScheme } from "@prisma/client";
import type { SemanticCluster } from "@/lib/schemes/semantic-clusters";

interface ClusterSchemeListProps {
  cluster: SemanticCluster;
  schemes: ArgumentScheme[];
  onSchemeSelect: (scheme: ArgumentScheme) => void;
  onBack: () => void;
  compact?: boolean;
}

export function ClusterSchemeList({
  cluster,
  schemes,
  onSchemeSelect,
  onBack,
  compact = false,
}: ClusterSchemeListProps) {
  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to all clusters
        </Button>

        <div className="text-center">
          <div className="text-5xl mb-3">{cluster.icon}</div>
          <h2 className="text-2xl font-bold mb-2">{cluster.name}</h2>
          <p className="text-muted-foreground mb-4">{cluster.description}</p>

          {!compact && (
            <Card className="bg-muted/50 p-4 max-w-2xl mx-auto">
              <p className="text-sm">
                <span className="font-medium">When to use: </span>
                {cluster.typicalUse}
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Scheme count */}
      <div className="text-center">
        <Badge variant="secondary">
          {schemes.length} {schemes.length === 1 ? "scheme" : "schemes"}
        </Badge>
      </div>

      {/* Scheme list */}
      {schemes.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No schemes found in this cluster.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {schemes.map((scheme) => (
            <SchemeCard
              key={scheme.id}
              scheme={scheme}
              onSelect={() => onSchemeSelect(scheme)}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SchemeCardProps {
  scheme: ArgumentScheme;
  onSelect: () => void;
  compact?: boolean;
}

function SchemeCard({ scheme, onSelect, compact = false }: SchemeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get critical questions (handle both field names for compatibility)
  const criticalQuestions =
    (scheme as any).criticalQuestions ||
    (scheme as any).cqs ||
    [];

  // Cast JSON fields for TypeScript - handle both string and object formats
  const premises = Array.isArray(scheme.premises) 
    ? (scheme.premises as any[]).map((p: any) => 
        typeof p === "string" ? p : p?.text || JSON.stringify(p)
      )
    : [];
  const conclusion = typeof scheme.conclusion === "string" 
    ? scheme.conclusion 
    : (scheme.conclusion as any)?.text || "";

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Name */}
          <h3 className="font-bold text-lg mb-2">{scheme.name}</h3>

          {/* Summary */}
          {scheme.summary && (
            <p className="text-sm text-muted-foreground mb-3">
              {scheme.summary}
            </p>
          )}

          {/* Expandable details */}
          {isExpanded && !compact && (
            <div className="space-y-3 mt-4 pt-4 border-t">
              {/* Premises */}
              {premises.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    Premises:
                  </p>
                  <ul className="space-y-1">
                    {premises.map((premise, idx) => (
                      <li
                        key={idx}
                        className="text-sm pl-4 border-l-2"
                      >
                        {premise}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Conclusion */}
              {conclusion && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    Conclusion:
                  </p>
                  <p className="text-sm pl-4 border-l-2">
                    {conclusion}
                  </p>
                </div>
              )}

              {/* Critical Questions */}
              {criticalQuestions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    Critical Questions:
                  </p>
                  <ul className="space-y-1">
                    {criticalQuestions.slice(0, 3).map((cq: any, idx: number) => (
                      <li
                        key={idx}
                        className="text-sm pl-4 border-l-2"
                      >
                        {typeof cq === "string" ? cq : cq.question}
                      </li>
                    ))}
                    {criticalQuestions.length > 3 && (
                      <li className="text-xs text-muted-foreground pl-4">
                        +{criticalQuestions.length - 3} more questions
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 shrink-0">
          <Button onClick={onSelect} size="sm">
            Select
          </Button>

          {!compact && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Details
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
