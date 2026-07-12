// components/issues/ClarificationRequestButton.tsx
"use client";

import * as React from "react";
import { HelpCircle, MessageCircleQuestion } from "lucide-react";
import { IssueComposer } from "./IssueComposerExtended";
import { useMicroToast } from "@/hooks/useMicroToast";

export function ClarificationRequestButton({
  deliberationId,
  targetType,
  targetId,
  targetLabel,
  className,
  onSuccess,
}: {
  deliberationId: string;
  targetType: "argument" | "claim";
  targetId: string;
  targetLabel: string;
  className?: string;
  onSuccess?: (issueId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const toast = useMicroToast();

  return (
    <>
      {toast.node}
      <button
        onClick={() => setOpen(true)}
        className={
          className ||
          `inline-flex items-center gap-2 px-2 py-2 btnv2 rounded-lg text-xs font-medium
           text-slate-600 border border-slate-200
          hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700
          transition-all duration-200`
        }
      >
        <MessageCircleQuestion className="w-3.5 h-3.5" />
        Request Clarification
      </button>

      {open && (
        <IssueComposer
          deliberationId={deliberationId}
          kind="clarification"
          initialTarget={{ type: targetType, id: targetId }}
          initialLabel={
            targetLabel.length > 100
              ? `Clarification: ${targetLabel.slice(0, 97)}...`
              : `Clarification: ${targetLabel}`
          }
          open={open}
          onOpenChange={setOpen}
          onCreated={(issueId: string) => {
            console.log("[ClarificationRequest] Created issue:", issueId);
            onSuccess?.(issueId);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
