"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArgumentNetAnalyzer } from "@/components/argumentation/ArgumentNetAnalyzer";
import { SchemeSpecificCQsModal } from "./SchemeSpecificCQsModal";

// ============================================================================
// Types
// ============================================================================

interface SchemeAnalyzerProps {
  argumentId: string;
  deliberationId: string;
  authorId: string;
  currentUserId?: string;
  
  // For backward compatibility with SchemeSpecificCQsModal
  cqs?: any[];
  meta?: any;
  onRefresh?: () => void;
  triggerButton?: React.ReactNode;
  
  // New props for net analysis
  preferNetView?: boolean; // Force net view if detected
  compact?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * SchemeAnalyzer - Unified analysis component
 * 
 * Automatically detects if argument is part of a multi-scheme net and shows
 * ArgumentNetAnalyzer. Falls back to SchemeSpecificCQsModal for single schemes.
 * 
 * This provides a smooth upgrade path:
 * - Single scheme arguments: Traditional CQ modal (backward compatible)
 * - Multi-scheme nets: Full net visualization + analysis
 */
export function SchemeAnalyzer({
  argumentId,
  deliberationId,
  authorId,
  currentUserId,
  cqs = [],
  meta,
  onRefresh,
  triggerButton,
  preferNetView = true,
  compact = false,
}: SchemeAnalyzerProps) {
  const [open, setOpen] = React.useState(false);
  const [netDetected, setNetDetected] = React.useState<boolean | null>(null);
  const [detecting, setDetecting] = React.useState(false);

  // Detect net when modal opens
  React.useEffect(() => {
    if (open && preferNetView && netDetected === null && !detecting) {
      detectNet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preferNetView, netDetected, detecting]);

  const detectNet = async () => {
    setDetecting(true);
    
    try {
      const response = await fetch("/api/nets/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ argumentId }),
      });

      if (response.ok) {
        const data = await response.json();
        setNetDetected(!!data.net);
      } else {
        setNetDetected(false);
      }
    } catch (error) {
      console.error("Net detection error:", error);
      setNetDetected(false);
    } finally {
      setDetecting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    
    // Reset detection when closing
    if (!newOpen) {
      // Don't reset immediately - keep for smooth re-opening
      setTimeout(() => {
        if (!open) {
          setNetDetected(null);
        }
      }, 500);
    }
  };

  // Default trigger button
  const defaultTrigger = (
    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
      Analyze Argument
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {triggerButton || defaultTrigger}
      </DialogTrigger>

      <DialogContent className="max-w-[95vw] max-h-[95vh] bg-white overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {detecting
              ? "Analyzing Argument..."
              : netDetected
              ? "Multi-Scheme Argument Analysis"
              : "Critical Questions"}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {/* Show net analyzer if detected or still detecting */}
          {(preferNetView && (netDetected || detecting)) ? (
            <ArgumentNetAnalyzer
              argumentId={argumentId}
              deliberationId={deliberationId}
              currentUserId={currentUserId}
              defaultView="visualization"
              showManagement={false} // Hide version/export in modal view
              compact={compact}
              onNetDetected={(netId) => {
                setNetDetected(!!netId);
              }}
            />
          ) : (
            /* Fallback to traditional CQ modal for single schemes */
            <SchemeSpecificCQsModal
              argumentId={argumentId}
              deliberationId={deliberationId}
              authorId={authorId}
              currentUserId={currentUserId}
              cqs={cqs}
              meta={meta}
              onRefresh={onRefresh || (() => {})}
              triggerButton={<></>} // No trigger needed - already in dialog
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Export both for backward compatibility
// ============================================================================

export { SchemeSpecificCQsModal };
