/**
 * ConditionCheckbox Component
 * 
 * Displays a single identification condition as a checkbox
 * with expandable details showing examples.
 * 
 * Week 7, Task 7.2: Filter UI Components
 */

"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IdentificationCondition } from "@/lib/schemes/identification-conditions";

interface ConditionCheckboxProps {
  condition: IdentificationCondition;
  checked: boolean;
  onToggle: () => void;
  compact?: boolean;
}

export function ConditionCheckbox({
  condition,
  checked,
  onToggle,
  compact = false,
}: ConditionCheckboxProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      className={cn(
        " shadow-md border bg-slate-50  rounded-lg transition-colors",
        checked && "bg-sky-50 dark:bg-sky-950 border-sky-400 dark:border-sky-700",
        !checked && "bg-slate-50 dark:bg-gray-900 border-gray-400 dark:border-gray-800",
        compact ? "p-2" : "p-3"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <Checkbox
          id={condition.id}
          checked={checked}
          onCheckedChange={onToggle}
          className="mt-1 border-gray-400 dark:border-gray-600"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <label
            htmlFor={condition.id}
            className="font-medium text-sm cursor-pointer hover:text-primary transition-colors"
          >
            {condition.label}
          </label>

          {!compact && (
            <p className="text-xs text-muted-foreground mt-1">
              {condition.description}
            </p>
          )}

          {/* Weight badge */}
          {!compact && (
            <Badge variant="outline" className="text-xs mt-2">
              {condition.schemeKeys.length} {condition.schemeKeys.length === 1 ? "scheme" : "schemes"}
            </Badge>
          )}
        </div>

        {/* Details toggle */}
        {!compact && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
            aria-label={showDetails ? "Hide examples" : "Show examples"}
          >
            {showDetails ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <HelpCircle className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Expandable details */}
      {showDetails && !compact && (
        <div className="mt-3 pt-3 border-t space-y-2 animate-in fade-in duration-200">
          <p className="text-xs font-semibold text-muted-foreground">
            Examples:
          </p>
          <ul className="space-y-1">
            {condition.examples.map((example, idx) => (
              <li
                key={idx}
                className="text-xs pl-4 border-l-2 border-sky-300 dark:border-sky-700"
              >
                &ldquo;{example}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
