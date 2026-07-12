"use client";

import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================
// Types
// ============================

interface ConfidenceSliderProps {
  /**
   * Current confidence value (0-1 scale)
   */
  value: number;

  /**
   * Callback when confidence changes
   */
  onChange: (value: number) => void;

  /**
   * Optional label text. Defaults to "Confidence"
   */
  label?: string;

  /**
   * Optional helper text below slider
   */
  helperText?: string;

  /**
   * Display style: "badge" or "text"
   * @default "text"
   */
  displayStyle?: "badge" | "text";

  /**
   * Whether to show color-coded visual feedback
   * @default true
   */
  showColorFeedback?: boolean;

  /**
   * Minimum value (0-1 scale)
   * @default 0
   */
  min?: number;

  /**
   * Maximum value (0-1 scale)
   * @default 1
   */
  max?: number;

  /**
   * Step increment (0-1 scale)
   * @default 0.01
   */
  step?: number;

  /**
   * Optional CSS class name for the container
   */
  className?: string;
}

// ============================
// Helper Functions
// ============================

/**
 * Get color class based on confidence value
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-green-600 dark:text-green-400";
  if (confidence >= 0.6) return "text-blue-600 dark:text-blue-400";
  if (confidence >= 0.4) return "text-yellow-600 dark:text-yellow-400";
  if (confidence >= 0.2) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

/**
 * Get background color for slider based on confidence
 */
function getSliderColor(confidence: number): string {
  if (confidence >= 0.8) return "confidence-high";
  if (confidence >= 0.6) return "confidence-medium-high";
  if (confidence >= 0.4) return "confidence-medium";
  if (confidence >= 0.2) return "confidence-low";
  return "confidence-very-low";
}

/**
 * Get descriptive label for confidence level
 */
function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.6) return "Medium-High";
  if (confidence >= 0.4) return "Medium";
  if (confidence >= 0.2) return "Low";
  return "Very Low";
}

// ============================
// Main Component
// ============================

export function ConfidenceSlider({
  value,
  onChange,
  label = "Confidence",
  helperText,
  displayStyle = "text",
  showColorFeedback = true,
  min = 0,
  max = 1,
  step = 0.01,
  className,
}: ConfidenceSliderProps) {
  const percentage = Math.round(value * 100);
  const colorClass = showColorFeedback ? getConfidenceColor(value) : "";
  const sliderClass = showColorFeedback ? getSliderColor(value) : "";
  const confidenceLabel = getConfidenceLabel(value);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with label and value display */}
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {displayStyle === "badge" ? (
          <Badge variant="outline" className={cn(showColorFeedback && colorClass)}>
            {percentage}%
          </Badge>
        ) : (
          <span className={cn("text-sm font-medium", colorClass)}>
            {percentage}% {showColorFeedback && `(${confidenceLabel})`}
          </span>
        )}
      </div>

      {/* Slider */}
      <Slider
        value={[value]}
        onValueChange={([val]) => onChange(val)}
        min={min}
        max={max}
        step={step}
        className={cn("w-full", sliderClass)}
      />

      {/* Helper text */}
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}
