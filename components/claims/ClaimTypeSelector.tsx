"use client";

/**
 * ClaimTypeSelector - Academic Claim Type Selection Component
 * 
 * Phase 1.1: Paper-to-Claim Pipeline
 * 
 * Provides a dropdown selector and badge display for academic claim types.
 */

import { AcademicClaimType } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { 
  BookOpen, 
  Beaker, 
  History, 
  Lightbulb, 
  Scale, 
  Wrench, 
  GitCompare, 
  ArrowRightLeft, 
  Quote,
  FlaskConical,
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// Claim Type Metadata
// ─────────────────────────────────────────────────────────

export const CLAIM_TYPE_INFO: Record<
  AcademicClaimType,
  { 
    label: string; 
    description: string; 
    color: string; 
    bgColor: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  THESIS: {
    label: "Thesis",
    description: "The central argument or main claim of a work",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    icon: BookOpen,
  },
  INTERPRETIVE: {
    label: "Interpretive",
    description: "A reading or interpretation of text, event, or phenomenon",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: Quote,
  },
  HISTORICAL: {
    label: "Historical",
    description: "A factual claim about past events or conditions",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    icon: History,
  },
  CONCEPTUAL: {
    label: "Conceptual",
    description: "A definition, analysis, or clarification of a concept",
    color: "text-teal-700",
    bgColor: "bg-teal-100",
    icon: Lightbulb,
  },
  NORMATIVE: {
    label: "Normative",
    description: "An evaluative or prescriptive claim about what ought to be",
    color: "text-rose-700",
    bgColor: "bg-rose-100",
    icon: Scale,
  },
  METHODOLOGICAL: {
    label: "Methodological",
    description: "A claim about how to study or analyze something",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
    icon: Wrench,
  },
  COMPARATIVE: {
    label: "Comparative",
    description: "A claim relating or comparing two or more things",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    icon: GitCompare,
  },
  CAUSAL: {
    label: "Causal",
    description: "A claim about causation or causal mechanisms",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: ArrowRightLeft,
  },
  META: {
    label: "Meta",
    description: "A claim about the field, debate, or scholarship itself",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    icon: Beaker,
  },
  EMPIRICAL: {
    label: "Empirical",
    description: "A claim based on data, observations, or experiments",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: FlaskConical,
  },
};

// ─────────────────────────────────────────────────────────
// ClaimTypeSelector Component
// ─────────────────────────────────────────────────────────

interface ClaimTypeSelectorProps {
  value?: AcademicClaimType;
  onChange: (value: AcademicClaimType) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ClaimTypeSelector({
  value,
  onChange,
  disabled = false,
  placeholder = "Select claim type",
  className,
}: ClaimTypeSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as AcademicClaimType)}
      disabled={disabled}
    >
      <SelectTrigger className={className || "w-[200px]"}>
        <SelectValue placeholder={placeholder}>
          {value && (
            <div className="flex items-center gap-2">
              {(() => {
                const info = CLAIM_TYPE_INFO[value];
                const Icon = info.icon;
                return (
                  <>
                    <Icon className={`h-4 w-4 ${info.color}`} />
                    <span>{info.label}</span>
                  </>
                );
              })()}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(CLAIM_TYPE_INFO).map(([type, info]) => {
          const Icon = info.icon;
          return (
            <SelectItem key={type} value={type}>
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${info.color}`} />
                <div className="flex flex-col">
                  <span className="font-medium">{info.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {info.description}
                  </span>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// ─────────────────────────────────────────────────────────
// ClaimTypeBadge Component
// ─────────────────────────────────────────────────────────

interface ClaimTypeBadgeProps {
  type: AcademicClaimType;
  showIcon?: boolean;
  showTooltip?: boolean;
  size?: "sm" | "default";
}

export function ClaimTypeBadge({ 
  type, 
  showIcon = true,
  showTooltip = true,
  size = "default",
}: ClaimTypeBadgeProps) {
  const info = CLAIM_TYPE_INFO[type];
  if (!info) return null;

  const Icon = info.icon;
  const sizeClasses = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";

  const badge = (
    <Badge 
      className={`${info.bgColor} ${info.color} border-0 ${sizeClasses} font-medium`}
      variant="secondary"
    >
      {showIcon && <Icon className={`h-3 w-3 mr-1 ${size === "sm" ? "h-2.5 w-2.5" : ""}`} />}
      {info.label}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="text-sm">{info.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────
// ClaimTypeIcon Component
// ─────────────────────────────────────────────────────────

interface ClaimTypeIconProps {
  type: AcademicClaimType;
  className?: string;
}

export function ClaimTypeIcon({ type, className }: ClaimTypeIconProps) {
  const info = CLAIM_TYPE_INFO[type];
  if (!info) return null;

  const Icon = info.icon;
  return <Icon className={className || `h-4 w-4 ${info.color}`} />;
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

/**
 * Get a human-readable label for a claim type
 */
export function getClaimTypeLabel(type: AcademicClaimType): string {
  return CLAIM_TYPE_INFO[type]?.label || type;
}

/**
 * Get the description for a claim type
 */
export function getClaimTypeDescription(type: AcademicClaimType): string {
  return CLAIM_TYPE_INFO[type]?.description || "";
}

/**
 * Check if a string is a valid AcademicClaimType
 */
export function isValidClaimType(value: string): value is AcademicClaimType {
  return Object.keys(CLAIM_TYPE_INFO).includes(value);
}
