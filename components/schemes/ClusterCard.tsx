/**
 * ClusterCard Component
 * 
 * Displays a single semantic cluster as a clickable card
 * with icon, name, description, and scheme count.
 * 
 * Week 6, Task 6.2: Cluster Grid UI
 */

"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SemanticCluster } from "@/lib/schemes/semantic-clusters";

interface ClusterCardProps {
  cluster: SemanticCluster;
  schemeCount?: number;
  onClick: () => void;
  onHover?: () => void;
  isHovered?: boolean;
  compact?: boolean;
}

const colorClasses: Record<string, string> = {
  sky: "bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900",
  green: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900",
  purple: "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900",
  orange: "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900",
  yellow: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900",
  red: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900",
  indigo: "bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900",
  gray: "bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900",
  slate: "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900",
};

export function ClusterCard({
  cluster,
  schemeCount,
  onClick,
  onHover,
  isHovered = false,
  compact = false,
}: ClusterCardProps) {
  const colorClass = colorClasses[cluster.color] || colorClasses.gray;

  return (
    <Card
      className={cn(
        "cursor-pointer panelv2 transition-all duration-200 border-2",
        "hover:shadow-md ",
        colorClass,
        isHovered && " ring-2 ring-primary ring-offset-0",
        compact ? "p-4" : "p-6"
      )}
      onClick={onClick}
      onMouseEnter={onHover}
    >
      {/* Icon */}
      <div
        className={cn(
          "mb-3 text-center",
          compact ? "text-3xl" : "text-5xl"
        )}
      >
        {cluster.icon}
      </div>

      {/* Name */}
      <h3
        className={cn(
          "font-bold text-center mb-2",
          compact ? "text-base" : "text-xl"
        )}
      >
        {cluster.name}
      </h3>

      {/* Description */}
      {!compact && (
        <p className="text-sm text-muted-foreground text-center mb-3">
          {cluster.description}
        </p>
      )}

      {/* Scheme count badge */}
      {schemeCount !== undefined && (
        <div className="flex justify-center mt-3">
          <Badge variant="secondary" className="text-xs">
            {schemeCount} {schemeCount === 1 ? "scheme" : "schemes"}
          </Badge>
        </div>
      )}

      {/* Hover indicator */}
      {isHovered && !compact && (
        <div className="text-center mt-3 text-sm font-medium text-primary">
          Click to explore →
        </div>
      )}
       {!isHovered && !compact && (
        <div className="text-center mt-3 opacity-0 text-sm font-medium text-primary">
          Click to explore →
        </div>
      )}
      
    </Card>
  );
}
