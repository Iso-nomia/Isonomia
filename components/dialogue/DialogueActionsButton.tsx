// components/dialogue/DialogueActionsButton.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import { DialogueActionsModal } from "./DialogueActionsModal";
import { MessageSquare } from "lucide-react";
import { TargetType } from "@prisma/client";
import type { ProtocolKind } from "./command-card/types";

export interface DialogueActionsButtonProps {
  // Target context
  deliberationId: string;
  targetType: TargetType;
  targetId: string;
  locusPath?: string;

  // Optional: pre-select a move kind when opened
  initialMove?: ProtocolKind;

  // Optional: limit to specific categories
  categories?: ("protocol" | "structural" | "cqs" | "scaffold")[];

  // Callbacks
  onMovePerformed?: () => void;

  // Button customization
  label?: string;
  variant?: "default" | "compact" | "icon";
  className?: string;
}

/**
 * DialogueActionsButton - A trigger button that opens the comprehensive DialogueActionsModal
 * 
 * Usage:
 * ```tsx
 * <DialogueActionsButton
 *   deliberationId={deliberationId}
 *   targetType="argument"
 *   targetId={argumentId}
 *   label="Dialogue Moves"
 *   onMovePerformed={() => refetch()}
 * />
 * ```
 */
export function DialogueActionsButton({
  deliberationId,
  targetType,
  targetId,
  locusPath = "0",
  initialMove,
  categories = ["protocol", "structural", "cqs"],
  onMovePerformed,
  label = "Dialogue Moves",
  variant = "default",
  className = "",
}: DialogueActionsButtonProps) {
  const [open, setOpen] = useState(false);

  const baseStyles = "inline-flex items-center gap-1 transition-all duration-200";
  
  const variantStyles = {
    default: "px-4 py-2 bg-indigo-600 text-white  rounded-lg hover:bg-indigo-700 shadow-md hover:shadow-lg text-sm font-medium",
    compact: "px-3 py-1 bg-indigo-50/50 border rounded-full border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs font-medium",
    icon: "px-4 py-1 hover:bg-indigo-50  rounded-lg border border-indigo-300 text-slate-700 bg-slate-50 hover:border-indigo-300 hover:text-indigo-700",
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
        aria-label={label}
      >
        <MessageSquare className={variant === "compact" ? "w-3 h-3" : "w-4 h-4"} />
        {variant !== "icon" && <span>{label}</span>}
      </button>

      <DialogueActionsModal
        open={open}
        onOpenChange={setOpen}
        deliberationId={deliberationId}
        targetType={targetType}
        targetId={targetId}
        locusPath={locusPath}
        initialMove={initialMove}
        categories={categories}
        onMovePerformed={() => {
          onMovePerformed?.();
          // Keep modal open so user can perform multiple moves if needed
        }}
      />
    </>
  );
}
