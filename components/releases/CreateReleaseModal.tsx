"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Tag, ArrowUp, ArrowUpRight, ArrowUpCircle } from "lucide-react";

/**
 * CreateReleaseModal - Modal for creating a new deliberation release
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 */

const createReleaseSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  versionType: z.enum(["major", "minor", "patch"]),
});

type CreateReleaseForm = z.infer<typeof createReleaseSchema>;

export interface CreateReleaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliberationId: string;
  currentVersion?: string;
  onSuccess?: (release: { id: string; version: string }) => void;
}

export function CreateReleaseModal({
  open,
  onOpenChange,
  deliberationId,
  currentVersion,
  onSuccess,
}: CreateReleaseModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<CreateReleaseForm>({
    resolver: zodResolver(createReleaseSchema),
    defaultValues: {
      title: "",
      description: "",
      versionType: "patch",
    },
  });

  const versionType = form.watch("versionType");

  // Calculate preview version
  const previewVersion = React.useMemo(() => {
    if (!currentVersion) return "1.0.0";
    
    const parts = currentVersion.replace(/^v/, "").split(".").map(Number);
    if (parts.length !== 3) return currentVersion;

    const [major, minor, patch] = parts;
    switch (versionType) {
      case "major": return `${major + 1}.0.0`;
      case "minor": return `${major}.${minor + 1}.0`;
      case "patch": return `${major}.${minor}.${patch + 1}`;
      default: return currentVersion;
    }
  }, [currentVersion, versionType]);

  const handleSubmit = async (data: CreateReleaseForm) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/deliberations/${deliberationId}/releases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title || undefined,
          description: data.description || undefined,
          versionType: data.versionType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create release");
      }

      const release = await response.json();
      onSuccess?.({ id: release.id, version: release.version });
      onOpenChange(false);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Create Release
          </DialogTitle>
          <DialogDescription>
            Create a versioned snapshot of the current deliberation state.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Version Type Selection */}
          <div className="space-y-2">
            <Label>Version Type</Label>
            <RadioGroup
              value={versionType}
              onValueChange={(v) => form.setValue("versionType", v as "major" | "minor" | "patch")}
              className="grid grid-cols-3 gap-2"
            >
              <label
                className={`flex flex-col items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  versionType === "patch"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <RadioGroupItem value="patch" className="sr-only" />
                <ArrowUp className="w-4 h-4 mb-1 text-slate-500" />
                <span className="text-xs font-medium">Patch</span>
                <span className="text-[10px] text-slate-400">Bug fixes</span>
              </label>
              <label
                className={`flex flex-col items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  versionType === "minor"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <RadioGroupItem value="minor" className="sr-only" />
                <ArrowUpRight className="w-4 h-4 mb-1 text-slate-500" />
                <span className="text-xs font-medium">Minor</span>
                <span className="text-[10px] text-slate-400">New content</span>
              </label>
              <label
                className={`flex flex-col items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  versionType === "major"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <RadioGroupItem value="major" className="sr-only" />
                <ArrowUpCircle className="w-4 h-4 mb-1 text-slate-500" />
                <span className="text-xs font-medium">Major</span>
                <span className="text-[10px] text-slate-400">Breaking changes</span>
              </label>
            </RadioGroup>
            
            {/* Version Preview */}
            <div className="text-center py-2">
              <span className="text-xs text-slate-400">New version: </span>
              <span className="font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">
                v{previewVersion}
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              placeholder={`Release ${previewVersion}`}
              {...form.register("title")}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Release Notes (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the changes in this release..."
              rows={3}
              {...form.register("description")}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>Create Release</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
