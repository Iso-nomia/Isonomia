// components/arguments/SchemeBreakdownModal.tsx
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SchemeBreakdown } from "./SchemeBreakdown";
import { SchemeManagementPanel } from "./SchemeManagementPanel";
import { LayoutPanelTop, Sparkles } from "lucide-react";

interface SchemeBreakdownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  argumentId: string;
  argumentText?: string; // Optional: show the argument conclusion text in the header
  enableEditing?: boolean; // If true, show SchemeManagementPanel instead of SchemeBreakdown
}

export function SchemeBreakdownModal({
  open,
  onOpenChange,
  argumentId,
  argumentText,
  enableEditing = false,
}: SchemeBreakdownModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!z-[60] bg-white/85  backdrop-blur-xl rounded-xl max-w-[90vw] w-full sm:max-w-[920px] max-h-[85vh] overflow-y-auto panel-edge">
        {/* Decorative background elements */}
        <div className="absolute top-10 right-20 w-24 h-24 bg-indigo-400/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute bottom-20 left-10 w-32 h-32 bg-purple-400/8 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none" />
        
        <div className="relative z-10">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-indigo-900 flex items-center gap-2">
              <LayoutPanelTop className="w-5 h-5 text-indigo-600" />
              Argumentation Schemes
              {enableEditing && (
                <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  Management Mode
                </span>
              )}
            </DialogTitle>
            {argumentText && (
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                For argument: <span className="font-medium text-slate-800">{argumentText}</span>
              </p>
            )}
          </DialogHeader>
          
          <div className="mt-2 px-2">
            {enableEditing ? (
              <SchemeManagementPanel argumentId={argumentId} />
            ) : (
              <SchemeBreakdown argumentId={argumentId} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
