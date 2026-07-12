"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, GripVertical } from "lucide-react";
import { ConfidenceSlider } from "@/components/argumentation/ConfidenceSlider";

// ============================
// Types
// ============================

export interface NetStep {
  id: string;
  schemeId: string;
  schemeName?: string;
  label: string;
  stepText: string;
  confidence: number;
  order: number;
  inputFromStep: number | null;
  inputSlotMapping: Record<string, string> | null;
}

export interface Scheme {
  id: string;
  name: string;
  description?: string;
}

interface NetStepCardProps {
  step: NetStep;
  index: number;
  schemes: Scheme[];
  onUpdate: (updates: Partial<NetStep>) => void;
  onRemove: () => void;
  showSlotMapping?: boolean;
}

// ============================
// Main Component
// ============================

export function NetStepCard({
  step,
  index,
  schemes,
  onUpdate,
  onRemove,
  showSlotMapping = false,
}: NetStepCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
      {/* Header */}
      <div className="flex items-center gap-2">
        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
        <Badge variant="outline">Step {step.order}</Badge>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Scheme Selection */}
      <div className="space-y-2">
        <Label>Argumentation Scheme *</Label>
        <Select value={step.schemeId} onValueChange={(val) => onUpdate({ schemeId: val })}>
          <SelectTrigger>
            <SelectValue placeholder="Select a scheme..." />
          </SelectTrigger>
          <SelectContent>
            {schemes.map((scheme) => (
              <SelectItem key={scheme.id} value={scheme.id}>
                {scheme.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Label */}
      <div className="space-y-2">
        <Label>Step Label *</Label>
        <Input
          placeholder="e.g., Expert Consensus, Classification, etc."
          value={step.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </div>

      {/* Text */}
      <div className="space-y-2">
        <Label>Step Text (Optional)</Label>
        <Textarea
          placeholder="Quote or text excerpt that shows this inferential step..."
          value={step.stepText}
          onChange={(e) => onUpdate({ stepText: e.target.value })}
          rows={2}
        />
      </div>

      {/* Confidence Slider */}
      <ConfidenceSlider
        value={step.confidence}
        onChange={(val) => onUpdate({ confidence: val })}
        helperText="How confident are you that this inferential step is valid?"
      />

      {/* Optional Slot Mapping */}
      {showSlotMapping && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs">Slot Mapping (Advanced, Optional)</Label>
          <Textarea
            placeholder='{"conclusionVar": "premiseVar"}'
            value={
              step.inputSlotMapping
                ? JSON.stringify(step.inputSlotMapping, null, 2)
                : ""
            }
            onChange={(e) => {
              try {
                const parsed = e.target.value ? JSON.parse(e.target.value) : null;
                onUpdate({ inputSlotMapping: parsed });
              } catch {
                // Invalid JSON, ignore
              }
            }}
            rows={3}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Optional JSON mapping of conclusion variables to premise variables
          </p>
        </div>
      )}
    </div>
  );
}
