/**
 * Phase 5.1: Concept summary card
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";
import { ConceptSummary } from "@/lib/crossfield/types";

interface ConceptCardProps {
  concept: ConceptSummary;
  onClick?: () => void;
  showField?: boolean;
}

export function ConceptCard({
  concept,
  onClick,
  showField = false,
}: ConceptCardProps) {
  return (
    <div
      className={`
        p-4 border rounded-lg transition-colors
        ${onClick ? "hover:bg-gray-50 cursor-pointer" : ""}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">{concept.name}</h4>
          {showField && (
            <p className="text-xs text-gray-500 mt-0.5">{concept.fieldName}</p>
          )}
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {concept.definition}
          </p>
        </div>

        {concept.equivalenceCount > 0 && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            {concept.equivalenceCount}
          </Badge>
        )}
      </div>

      {concept.aliases.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {concept.aliases.slice(0, 3).map((alias) => (
            <Badge key={alias} variant="outline" className="text-xs">
              {alias}
            </Badge>
          ))}
          {concept.aliases.length > 3 && (
            <span className="text-xs text-gray-400">
              +{concept.aliases.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
