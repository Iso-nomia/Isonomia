/**
 * ConditionHelp Component
 * 
 * Displays detailed help information for a specific condition category.
 * Shows description, when to use, examples, and tips.
 * 
 * Week 7, Task 7.4: Explanatory Text System
 */

"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Lightbulb, CheckCircle2 } from "lucide-react";
import type { ConditionCategory } from "@/lib/schemes/identification-conditions";
import { getCategoryHelp } from "@/lib/schemes/category-help";

interface ConditionHelpProps {
  category: ConditionCategory;
  compact?: boolean;
}

export function ConditionHelp({ category, compact = false }: ConditionHelpProps) {
  const help = getCategoryHelp(category);

  return (
    <Card className={`${compact ? "p-3" : "p-4"} bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800`}>
      <div className="space-y-3">
        {/* Title */}
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <h4 className="font-semibold text-sky-900 dark:text-sky-100">
            About {help.title}
          </h4>
        </div>

        {/* Description */}
        <p className="text-sm text-sky-800 dark:text-sky-200">
          {help.description}
        </p>

        {/* When to Use */}
        <div className="bg-white dark:bg-gray-900 rounded-md p-3 border border-sky-200 dark:border-sky-800">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            When to use
          </p>
          <p className="text-sm">{help.whenToUse}</p>
        </div>

        {/* Examples */}
        {help.examples.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Examples
              </p>
            </div>
            <div className="space-y-2">
              {help.examples.map((example, idx) => (
                <div
                  key={idx}
                  className="text-sm bg-white dark:bg-gray-900 rounded p-2 border border-sky-100 dark:border-sky-900"
                >
                  {example}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {help.tips.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tips for identification
              </p>
            </div>
            <ul className="space-y-1 text-sm">
              {help.tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5 shrink-0">
                    {idx + 1}
                  </Badge>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
