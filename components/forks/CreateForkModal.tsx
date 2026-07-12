"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { Loader2, GitFork, ArrowRight } from "lucide-react";
import { ForkTypePicker, ForkType, FORK_TYPE_CONFIG } from "./ForkBadge";

/**
 * CreateForkModal - Modal for creating a deliberation fork
 * 
 * Phase 2.2: Fork/Branch/Merge for Deliberations
 */

const createForkSchema = z.object({
  forkType: z.enum([
    "ASSUMPTION_VARIANT",
    "METHODOLOGICAL",
    "SCOPE_EXTENSION",
    "ADVERSARIAL",
    "EDUCATIONAL",
    "ARCHIVAL",
  ]),
  title: z.string().min(1, "Title is required").max(200),
  forkReason: z.string().min(1, "Reason is required").max(1000),
  includeAllClaims: z.boolean(),
  includeAllArguments: z.boolean(),
});

type CreateForkForm = z.infer<typeof createForkSchema>;

export interface CreateForkResult {
  id: string;
  title: string;
  forkType: ForkType;
}

export interface CreateForkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliberationId: string;
  deliberationTitle?: string;
  onSuccess?: (fork: CreateForkResult) => void;
}

export function CreateForkModal({
  open,
  onOpenChange,
  deliberationId,
  deliberationTitle,
  onSuccess,
}: CreateForkModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<"type" | "details">("type");

  const form = useForm<CreateForkForm>({
    resolver: zodResolver(createForkSchema),
    defaultValues: {
      forkType: "ASSUMPTION_VARIANT",
      title: "",
      forkReason: "",
      includeAllClaims: true,
      includeAllArguments: true,
    },
  });

  const forkType = form.watch("forkType");
  const config = FORK_TYPE_CONFIG[forkType];

  // Reset when modal opens
  React.useEffect(() => {
    if (open) {
      form.reset();
      setStep("type");
      setError(null);
    }
  }, [open, form]);

  const handleSubmit = async (data: CreateForkForm) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/deliberations/${deliberationId}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forkType: data.forkType,
          title: data.title,
          forkReason: data.forkReason,
          includeAllClaims: data.includeAllClaims,
          includeAllArguments: data.includeAllArguments,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create fork");
      }

      const fork = await response.json();

      onSuccess?.({
        id: fork.id,
        title: fork.title,
        forkType: fork.forkType,
      });

      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitFork className="w-5 h-5 text-primary" />
            Create Fork
          </DialogTitle>
          <DialogDescription>
            {deliberationTitle ? (
              <>Fork &quot;{deliberationTitle}&quot; to explore alternative directions.</>
            ) : (
              <>Fork this deliberation to explore alternative directions.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          {step === "type" ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Fork Type
                </Label>
                <Controller
                  name="forkType"
                  control={form.control}
                  render={({ field }) => (
                    <ForkTypePicker
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  type="button"
                  onClick={() => setStep("details")}
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected type indicator */}
              <div
                className={`flex items-center gap-2 p-2 rounded-lg ${config.bgColor} ${config.borderColor} border`}
              >
                {React.createElement(config.icon, {
                  className: `w-4 h-4 ${config.color}`,
                })}
                <span className={`text-sm font-medium ${config.color}`}>
                  {config.label}
                </span>
                <button
                  type="button"
                  onClick={() => setStep("type")}
                  className="ml-auto text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Change
                </button>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Fork Title</Label>
                <Input
                  id="title"
                  placeholder="Enter a title for this fork..."
                  {...form.register("title")}
                  disabled={isSubmitting}
                />
                {form.formState.errors.title && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="forkReason">Reason for Fork</Label>
                <Textarea
                  id="forkReason"
                  placeholder="Explain why you're creating this fork..."
                  rows={3}
                  {...form.register("forkReason")}
                  disabled={isSubmitting}
                />
                {form.formState.errors.forkReason && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.forkReason.message}
                  </p>
                )}
              </div>

              {/* Content inclusion options */}
              <div className="space-y-3 pt-2">
                <Label className="text-sm font-medium">Include Content</Label>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      All Claims
                    </p>
                    <p className="text-xs text-slate-500">
                      Copy all claims to the fork
                    </p>
                  </div>
                  <Controller
                    name="includeAllClaims"
                    control={form.control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    )}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      All Arguments
                    </p>
                    <p className="text-xs text-slate-500">
                      Copy all arguments to the fork
                    </p>
                  </div>
                  <Controller
                    name="includeAllArguments"
                    control={form.control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Error display */}
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep("type")}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <GitFork className="w-4 h-4 mr-2" />
                      Create Fork
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
