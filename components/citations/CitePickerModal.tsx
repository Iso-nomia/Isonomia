// components/citations/CitePickerModal.tsx
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CitePickerInlinePro from "@/components/citations/CitePickerInlinePro";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetType: "comment" | "claim" | "argument" | "card" | "move" | "work" | "proposition";
  targetId: string;
  title?: string;

  // prefill (optional)
  initialUrl?: string;
  initialDOI?: string;
  initialLocator?: string;
  initialQuote?: string;
  initialNote?: string;

  onDone?: () => void;
};

export default function CitePickerModal({
  open,
  onOpenChange,
  targetType,
  targetId,
  title = "Attach citation",
  initialUrl,
  initialDOI,
  initialLocator,
  initialQuote,
  initialNote,
  onDone,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] w-full bg-white">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">{title}</DialogTitle>
        </DialogHeader>

        <CitePickerInlinePro
          targetType={targetType}
          targetId={targetId}
          initialUrl={initialUrl}
          initialDOI={initialDOI}
          initialLocator={initialLocator}
          initialQuote={initialQuote}
          initialNote={initialNote}
          onDone={() => {
            onOpenChange(false);
            onDone?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
