/**
 * ConditionCategory Component
 * 
 * Groups identification conditions by category with
 * expand/collapse functionality.
 * 
 * Week 7, Task 7.2: Filter UI Components
 */

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConditionCheckbox } from "./ConditionCheckbox";
import { ConditionHelp } from "./ConditionHelp";
import type {
  IdentificationCondition,
  ConditionCategory as CategoryType,
} from "@/lib/schemes/identification-conditions";
import { categoryLabels } from "@/lib/schemes/identification-conditions";

interface ConditionCategoryProps {
  category: CategoryType;
  conditions: IdentificationCondition[];
  selectedConditions: string[];
  onToggleCondition: (conditionId: string) => void;
  defaultExpanded?: boolean;
  compact?: boolean;
}

export function ConditionCategory({
  category,
  conditions,
  selectedConditions,
  onToggleCondition,
  defaultExpanded = true,
  compact = false,
}: ConditionCategoryProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showHelp, setShowHelp] = useState(false);

  const selectedCount = conditions.filter((c) =>
    selectedConditions.includes(c.id)
  ).length;

  return (
    <Card className="overflow-hidden panelv2 p-1">
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}

          <h3 className="font-bold text-base">{categoryLabels[category]}</h3>

          <Badge variant={selectedCount > 0 ? "default" : "secondary"}>
            {selectedCount}/{conditions.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowHelp(!showHelp);
            }}
            className="h-7 px-2"
          >
            <HelpCircle className="items-centerw-4 h-4" />
          </Button>

         
        </div>
      </button>

      {/* Help Section */}
      {showHelp && (
        <div className="border-t p-4 bg-muted/30">
          <ConditionHelp category={category} compact={compact} />
        </div>
      )}

      {/* Conditions List */}
      {isExpanded && (
        <div
          className={cn(
            "border-t",
            compact ? "p-2 space-y-2" : "p-4 space-y-3"
          )}
        >
          {conditions.map((condition) => (
            <ConditionCheckbox
              key={condition.id}
              condition={condition}
              checked={selectedConditions.includes(condition.id)}
              onToggle={() => onToggleCondition(condition.id)}
              compact={compact}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
