// components/glossary/GlossaryEditorToolbar.tsx
"use client";

import { useState } from "react";
import { GlossaryTermPicker } from "./GlossaryTermPicker";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlossaryEditorToolbarProps {
  deliberationId: string;
  /** Callback when user selects a term to insert */
  onInsertTerm: (syntax: string, term: any) => void;
  /** Currently selected text in the editor (if any) */
  selectedText?: string;
  /** Show/hide preview of links */
  showPreview?: boolean;
  onTogglePreview?: (show: boolean) => void;
  className?: string;
}

export function GlossaryEditorToolbar({
  deliberationId,
  onInsertTerm,
  selectedText,
  showPreview = false,
  onTogglePreview,
  className
}: GlossaryEditorToolbarProps) {
  const [preview, setPreview] = useState(showPreview);

  const handleTogglePreview = () => {
    const newValue = !preview;
    setPreview(newValue);
    onTogglePreview?.(newValue);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <GlossaryTermPicker
        deliberationId={deliberationId}
        onSelectTerm={onInsertTerm}
        selectedText={selectedText}
      />
      
      {onTogglePreview && (
        <button
        
          onClick={handleTogglePreview}
          className={cn(
            "flex items-center gap-2",
            "menuv2--lite rounded-lg p-1"
          )}
          title={preview ? "Hide link preview" : "Show link preview"}
        >
          {preview ? (
            <>
              <EyeOff className="w-3 h-3" />
              <span className="text-xs">Hide Links</span>
            </>
          ) : (
            <>
              <Eye className="w-3 h-3" />
              <span className="text-xs">Preview Links</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
