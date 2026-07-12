"use client";

/**
 * VisibilitySelector
 * 
 * Phase 1.5 of Stacks Improvement Roadmap
 * 
 * UI component for selecting stack visibility mode.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  GlobeIcon, 
  LockIcon, 
  UsersIcon, 
  LinkIcon,
  AlertTriangleIcon 
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Visibility = "public_open" | "public_closed" | "private" | "unlisted";

interface VisibilitySelectorProps {
  value: Visibility;
  onChange: (value: Visibility) => void;
  disabled?: boolean;
  className?: string;
  showDescription?: boolean;
}

const visibilityOptions: {
  value: Visibility;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  warning?: string;
}[] = [
  {
    value: "public_open",
    label: "Public Open",
    description: "Anyone can view and add blocks",
    icon: GlobeIcon,
    warning: "Anyone can add content to this stack",
  },
  {
    value: "public_closed",
    label: "Public",
    description: "Anyone can view; only collaborators can add",
    icon: UsersIcon,
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Only people with the link can view",
    icon: LinkIcon,
  },
  {
    value: "private",
    label: "Private",
    description: "Only you and collaborators can access",
    icon: LockIcon,
  },
];

export function VisibilitySelector({
  value,
  onChange,
  disabled,
  className,
  showDescription = true,
}: VisibilitySelectorProps) {
  const selected = visibilityOptions.find((o) => o.value === value);

  return (
    <div className={cn("space-y-2", className)}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full bg-white">
          <SelectValue>
            <div className="flex items-center gap-2">
              {selected && <selected.icon className="h-4 w-4" />}
              <span>{selected?.label}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-white">
          {visibilityOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <option.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <div className="font-medium">{option.label}</div>
                  {showDescription && (
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected?.warning && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangleIcon className="h-3.5 w-3.5 flex-shrink-0" />
          {selected.warning}
        </div>
      )}
    </div>
  );
}

/**
 * Compact visibility badge for display only
 */
export function VisibilityBadge({ 
  visibility, 
  className 
}: { 
  visibility: Visibility; 
  className?: string;
}) {
  const option = visibilityOptions.find((o) => o.value === visibility);
  if (!option) return null;

  const Icon = option.icon;

  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs",
        visibility === "private" && "bg-gray-100 text-gray-700",
        visibility === "unlisted" && "bg-amber-50 text-amber-700",
        visibility === "public_closed" && "bg-blue-50 text-blue-700",
        visibility === "public_open" && "bg-green-50 text-green-700",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {option.label}
    </div>
  );
}

export { visibilityOptions };
