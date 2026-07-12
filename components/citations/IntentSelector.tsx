"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ThumbsUpIcon,
  ThumbsDownIcon,
  InfoIcon,
  BookOpenIcon,
  FlaskConicalIcon,
  BookmarkIcon,
  MessageSquareIcon,
  LightbulbIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type CitationIntentType =
  | "supports"
  | "refutes"
  | "context"
  | "defines"
  | "method"
  | "background"
  | "acknowledges"
  | "example";

interface IntentSelectorProps {
  value: CitationIntentType | null | undefined;
  onChange: (value: CitationIntentType | null) => void;
  compact?: boolean;
  /** Show a clear button to remove intent (defaults to true since intent is optional) */
  clearable?: boolean;
}

const intentOptions: {
  value: CitationIntentType;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}[] = [
  {
    value: "supports",
    label: "Supports claim",
    shortLabel: "Supports",
    icon: ThumbsUpIcon,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950",
  },
  {
    value: "refutes",
    label: "Refutes claim",
    shortLabel: "Refutes",
    icon: ThumbsDownIcon,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950",
  },
  {
    value: "context",
    label: "Provides context",
    shortLabel: "Context",
    icon: InfoIcon,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  {
    value: "defines",
    label: "Defines term",
    shortLabel: "Defines",
    icon: BookOpenIcon,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950",
  },
  {
    value: "method",
    label: "Methodology",
    shortLabel: "Method",
    icon: FlaskConicalIcon,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950",
  },
  {
    value: "background",
    label: "Background reading",
    shortLabel: "Background",
    icon: BookmarkIcon,
    color: "text-gray-600",
    bgColor: "bg-gray-50 dark:bg-gray-900",
  },
  {
    value: "acknowledges",
    label: "Acknowledges counterpoint",
    shortLabel: "Acknowledges",
    icon: MessageSquareIcon,
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950",
  },
  {
    value: "example",
    label: "Example / case study",
    shortLabel: "Example",
    icon: LightbulbIcon,
    color: "text-teal-600",
    bgColor: "bg-teal-50 dark:bg-teal-950",
  },
];

export function IntentSelector({
  value,
  onChange,
  compact,
  clearable = true,
}: IntentSelectorProps) {
  const selected = value ? intentOptions.find((o) => o.value === value) : null;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value ?? ""}
        onValueChange={(v) => onChange(v as CitationIntentType)}
      >
        <SelectTrigger className={compact ? "w-full" : "w-full"}>
          <SelectValue className="text-slate-600" placeholder="Add intent (optional)">
            {selected ? (
              <div className="flex items-center gap-2">
                <selected.icon className={`h-4 w-4 ${selected.color}`} />
                <span>{compact ? selected.shortLabel : selected.label}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Add intent</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {intentOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <option.icon className={`h-4 w-4 ${option.color}`} />
                <span>{option.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {clearable && value && (
        <button
          type="button"
   
          className="btnv2--ghost items-center rounded-md p-1 "
          onClick={() => onChange(null)}
          title="Clear"
        >
          <XIcon className="flex align-center h-4 p-1 w-4" />
        </ button>
      )}
    </div>
  );
}

/** Badge version for display */
export function IntentBadge({
  intent,
  showLabel = true,
}: {
  intent: CitationIntentType | null | undefined;
  showLabel?: boolean;
}) {
  if (!intent) return null;
  const option = intentOptions.find((o) => o.value === intent);
  if (!option) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${option.color} ${option.bgColor}`}
    >
      <option.icon className="h-3 w-3" />
      {showLabel && option.shortLabel}
    </span>
  );
}

/** Get intent configuration by value */
export function getIntentConfig(intent: CitationIntentType) {
  return intentOptions.find((o) => o.value === intent);
}

/** All available intents for iteration */
export const allIntents = intentOptions;
