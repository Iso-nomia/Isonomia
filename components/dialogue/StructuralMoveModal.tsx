"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, X } from "lucide-react";
import type { MoveKind } from "@/types/dialogue";

type StructuralMoveKind = Extract<MoveKind, "THEREFORE" | "SUPPOSE" | "DISCHARGE">;

interface StructuralMoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: StructuralMoveKind;
  onSubmit: (text: string) => void | Promise<void>;
}

const MOVE_CONFIG: Record<StructuralMoveKind, {
  title: string;
  description: string;
  placeholder: string;
  examples: string[];
  minLength: number;
}> = {
  THEREFORE: {
    title: "Assert a Conclusion",
    description: "State a conclusion that follows from the current discussion. This creates a positive assertion in the dialogue.",
    placeholder: "Therefore, the evidence clearly shows that...",
    examples: [
      "Therefore, renewable energy is more cost-effective in the long run",
      "Therefore, the proposed policy would reduce carbon emissions by 30%",
      "Therefore, we should prioritize this approach over alternatives",
    ],
    minLength: 10,
  },
  SUPPOSE: {
    title: "Open a Supposition",
    description: "Introduce a hypothetical assumption to explore its consequences. This opens a new scope in the dialogue.",
    placeholder: "Suppose that...",
    examples: [
      "Suppose gas prices triple in the next five years",
      "Suppose the technology becomes commercially viable",
      "Suppose the regulation is strictly enforced",
    ],
    minLength: 5,
  },
  DISCHARGE: {
    title: "Close the Supposition",
    description: "Conclude the hypothetical scope and return to the main discussion. This closes the current supposition in the dialogue.",
    placeholder: "Having explored this scenario...",
    examples: [
      "Having explored this scenario, we can see that the assumption leads to contradiction",
      "This hypothetical demonstrates the policy's robustness under extreme conditions",
      "The supposition reveals a critical weakness in the original argument",
    ],
    minLength: 5,
  },
};

export function StructuralMoveModal({
  open,
  onOpenChange,
  kind,
  onSubmit,
}: StructuralMoveModalProps) {
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [showExamples, setShowExamples] = React.useState(false);

  const config = MOVE_CONFIG[kind];

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < config.minLength) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(trimmed);
      setText("");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to submit move:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setText("");
    setShowExamples(false);
    onOpenChange(false);
  };

  const handleExampleClick = (example: string) => {
    setText(example);
    setShowExamples(false);
  };

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setText("");
      setShowExamples(false);
    }
  }, [open]);

  const isValid = text.trim().length >= config.minLength;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-50 border-2 border-indigo-300 ">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {config.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600 leading-relaxed">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Main textarea */}
          <div className="space-y-2">
            <label htmlFor="move-text" className="text-sm font-medium text-slate-700">
              Your {kind.toLowerCase()}:
            </label>
            <Textarea
              id="move-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={config.placeholder}
              rows={4}
              className="resize-none articlesearchfield"
              autoFocus
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {text.trim().length < config.minLength
                  ? `Minimum ${config.minLength} characters`
                  : `${text.trim().length} characters`}
              </span>
              {!isValid && text.length > 0 && (
                <span className="text-amber-600">
                  Need {config.minLength - text.trim().length} more characters
                </span>
              )}
            </div>
          </div>

          {/* Examples section */}
          <div className="border-t border-slate-200 pt-2">
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Lightbulb className="w-4 h-4" />
              {showExamples ? "Hide" : "Show"} Examples
            </button>

            {showExamples && (
              <div className="mt-3 space-y-2">
                {config.examples.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(example)}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-sm text-slate-700 hover:text-indigo-900"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex text-xs menuv2--lite rounded-xl px-2 py-2 gap-2"
          >
            Cancel
          </button>
          <button       
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="menuv2--lite text-xs rounded-xl px-2 py-2 gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Posting...
              </>
            ) : (
              <>
                Post {kind === "THEREFORE" ? "Conclusion" : kind === "SUPPOSE" ? "Supposition" : "Discharge"}
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
