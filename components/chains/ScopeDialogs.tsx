"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SCOPE_TYPE_CONFIG, type ScopeType } from "@/lib/types/argumentChain";
import {
  HelpCircle,
  GitBranch,
  ArrowRightCircle,
  User2,
  Sparkles,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const scopeIconMap: Record<ScopeType, LucideIcon> = {
  HYPOTHETICAL: HelpCircle,
  COUNTERFACTUAL: GitBranch,
  CONDITIONAL: ArrowRightCircle,
  OPPONENT: User2,
  MODAL: Sparkles,
};

const scopeTypes: ScopeType[] = [
  "HYPOTHETICAL",
  "COUNTERFACTUAL",
  "CONDITIONAL",
  "OPPONENT",
  "MODAL",
];

interface CreateScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    scopeType: ScopeType;
    assumption: string;
    color?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function CreateScopeDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: CreateScopeDialogProps) {
  const [scopeType, setScopeType] = useState<ScopeType>("HYPOTHETICAL");
  const [assumption, setAssumption] = useState("");
  const [customColor, setCustomColor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const selectedConfig = SCOPE_TYPE_CONFIG[scopeType];
  const displayColor = customColor || selectedConfig.color;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!assumption.trim()) {
      setError("Assumption is required");
      return;
    }

    try {
      await onSubmit({
        scopeType,
        assumption: assumption.trim(),
        color: customColor,
      });
      // Reset form on success
      setAssumption("");
      setCustomColor(undefined);
      setScopeType("HYPOTHETICAL");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scope");
    }
  };

  const handleClose = () => {
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-100 max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Hypothetical Scope</DialogTitle>
          <DialogDescription>
            Create a scope to group arguments that share a common assumption or
            hypothetical premise.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Scope Type Selection */}
          <div className="space-y-2">
            <Label>Scope Type</Label>
            <div className="grid grid-cols-5 gap-2">
              {scopeTypes.map((type) => {
                const config = SCOPE_TYPE_CONFIG[type];
                const Icon = scopeIconMap[type];
                const isSelected = type === scopeType;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setScopeType(type)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all",
                      isSelected
                        ? "ring-2 ring-offset-1"
                        : "opacity-60 hover:opacity-100"
                    )}
                    style={{
                      borderColor: config.color,
                      backgroundColor: isSelected ? `${config.color}15` : "transparent",
                      ...(isSelected && { ringColor: config.color }),
                    }}
                    title={config.description}
                  >
                    <Icon size={18} style={{ color: config.color }} />
                    <span
                      className="text-[10px] font-medium text-center leading-tight"
                      style={{ color: config.color }}
                    >
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedConfig.description}
            </p>
          </div>

          {/* Assumption Text */}
          <div className="space-y-2">
            <Label htmlFor="assumption">
              Assumption <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="assumption"
              placeholder={getPlaceholder(scopeType)}
              value={assumption}
              onChange={(e) => setAssumption(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              Describe the hypothetical premise that arguments in this scope share.
            </p>
          </div>

          {/* Custom Color (optional) */}
          <div className="space-y-2">
            <Label htmlFor="color">Custom Color (optional)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="color"
                type="color"
                value={displayColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <div
                className="flex-1 h-10 rounded-md border-2"
                style={{
                  backgroundColor: `${displayColor}15`,
                  borderColor: displayColor,
                  borderStyle: selectedConfig.borderStyle,
                }}
              />
              {customColor && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCustomColor(undefined)}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !assumption.trim()}
              style={{
                backgroundColor: displayColor,
                borderColor: displayColor,
              }}
            >
              {isLoading ? "Creating..." : "Create Scope"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getPlaceholder(scopeType: ScopeType): string {
  switch (scopeType) {
    case "HYPOTHETICAL":
      return "e.g., Suppose we implement a carbon tax...";
    case "COUNTERFACTUAL":
      return "e.g., Had we invested earlier in renewable energy...";
    case "CONDITIONAL":
      return "e.g., If inflation exceeds 5%...";
    case "OPPONENT":
      return "e.g., From the perspective of fiscal conservatives...";
    case "MODAL":
      return "e.g., It is possible that AI development accelerates...";
    default:
      return "Enter the shared assumption for this scope...";
  }
}

/**
 * Edit Scope Dialog - for updating existing scopes
 */
interface EditScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: {
    id: string;
    scopeType: ScopeType;
    assumption: string;
    color?: string | null;
  };
  onSubmit: (data: {
    assumption?: string;
    color?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function EditScopeDialog({
  open,
  onOpenChange,
  scope,
  onSubmit,
  isLoading,
}: EditScopeDialogProps) {
  const [assumption, setAssumption] = useState(scope.assumption);
  const [customColor, setCustomColor] = useState<string | undefined>(
    scope.color || undefined
  );
  const [error, setError] = useState<string | null>(null);

  const config = SCOPE_TYPE_CONFIG[scope.scopeType];
  const Icon = scopeIconMap[scope.scopeType];
  const displayColor = customColor || config.color;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!assumption.trim()) {
      setError("Assumption is required");
      return;
    }

    try {
      await onSubmit({
        assumption: assumption.trim(),
        color: customColor,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update scope");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon size={20} style={{ color: displayColor }} />
            Edit {config.label} Scope
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Assumption Text */}
          <div className="space-y-2">
            <Label htmlFor="edit-assumption">Assumption</Label>
            <Textarea
              id="edit-assumption"
              value={assumption}
              onChange={(e) => setAssumption(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Custom Color */}
          <div className="space-y-2">
            <Label htmlFor="edit-color">Color</Label>
            <div className="flex items-center gap-3">
              <Input
                id="edit-color"
                type="color"
                value={displayColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <div
                className="flex-1 h-10 rounded-md border-2"
                style={{
                  backgroundColor: `${displayColor}15`,
                  borderColor: displayColor,
                  borderStyle: config.borderStyle,
                }}
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateScopeDialog;
