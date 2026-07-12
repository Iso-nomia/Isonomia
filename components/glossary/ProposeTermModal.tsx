// components/glossary/ProposeTermModal.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, Send, Loader2, AlertCircle, CheckCircle2, Lightbulb } from "lucide-react";

// Custom scrollbar styles
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(192, 194, 222, 0.4);
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(218, 228, 239, 0.6);
  }
`;

interface ProposeTermModalProps {
  deliberationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProposed: () => void;
}

export function ProposeTermModal({
  deliberationId,
  open,
  onOpenChange,
  onProposed,
}: ProposeTermModalProps) {
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [examples, setExamples] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!term.trim() || !definition.trim()) {
      setError("Term and definition are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/deliberations/${deliberationId}/glossary/terms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term: term.trim(),
            definition: definition.trim(),
            examples: examples.trim() || undefined,
          }),
        }
      );

      if (response.ok) {
        setSuccess(true);
        onProposed();
        
        // Close after brief success message
        setTimeout(() => {
          onOpenChange(false);
          // Reset form
          setTerm("");
          setDefinition("");
          setExamples("");
          setSuccess(false);
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to propose term");
      }
    } catch (error) {
      console.error("Error proposing term:", error);
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <DialogContent className="max-w-3xl  max-h-screen overflow-hidden panel-edge-blue 
       bg-slate-900/75 backdrop-blur-xl shadow-2xl px-6 py-10">
        {/* Glass overlay effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/5 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.15),transparent_50%)] pointer-events-none" />
        
        {/* Water droplet decorations */}
        <div className="absolute top-10 right-20 w-32 h-32 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-10 w-40 h-40 bg-cyan-400/15 rounded-full blur-3xl animate-pulse delay-1000" />
        
        <div className="relative z-10 overflow-y-auto max-h-[85vh] custom-scrollbar px-2">
          <DialogHeader className="space-y-4 pb-4 border-b border-white/10">
            <DialogTitle className="text-3xl font-bold text-white flex items-center gap-3 drop-shadow-lg">
              <div className="p-2 rounded-2xl bg-gradient-to-b from-indigo-500/30 to-cyan-500/30 backdrop-blur-sm border border-white/20 shadow-lg">
                <BookOpen className="w-4 h-4 text-indigo-50" />
              </div>
              <span className="text-white/80 text-3xl tracking-wide">
                Propose New Term
              </span>
            </DialogTitle>
            <DialogDescription className="w-fit ml-1 text-xs border border-slate-100 rounded-xl text-white leading-relaxed px-2 py-1.5 bg-slate-700/40">
              Add a term to the deliberation glossary to help everyone stay on the same page
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-1 py-3">
            {/* Term Input */}
            <div className="space-y-3">
              <Label htmlFor="term" className="text-sm font-semibold text-indigo-100 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <p className="text-white tracking-wide">Term</p>

              </Label>
              <Input
                id="term"
                    autoComplete="off"

                value={term}
                onChange={(e) => setTerm(e.target.value)}
                disabled={isSubmitting || success}
                placeholder="The word or phrase you want to define..."
                required
                maxLength={100}
                className="bg-white/10 articlesearchfield backdrop-blur-md  text-white border-[1px] border-cyan-400/60 placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20 rounded-xl shadow-lg"
              />
              <div className="relative flex items-center justify-end text-xs">
                <div className="absolute bottom-5 right-3 text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded-md backdrop-blur-sm">
                  {term.length} / 100
                </div>
              </div>
            </div>

            {/* Definition Input */}
            <div className="space-y-3">
              <Label htmlFor="definition" className="text-sm font-semibold text-indigo-100 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                Definition
              </Label>
              <div className="relative">
                <Textarea
                  id="definition"
                  value={definition}
                  onChange={(e) => setDefinition(e.target.value)}
                  disabled={isSubmitting || success}
                  placeholder="Provide a clear, concise definition..."
                  rows={4}
                  maxLength={2000}
                  required
                  className="min-h-[110px] resize-y bg-white/10 backdrop-blur-md py-3 text-white border-[1px] border-cyan-400/60 placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20 rounded-xl shadow-lg"
                />
                <div className="absolute bottom-3 right-3 text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded-md backdrop-blur-sm">
                  {definition.length} / 2000
                </div>
              </div>
            </div>

            {/* Examples Input (Optional) */}
            <div className="space-y-3 py-2">
              <Label htmlFor="examples" className="text-sm font-semibold text-indigo-100 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Examples <span className="text-slate-400 text-xs font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <Textarea
                  id="examples"
                  value={examples}
                  onChange={(e) => setExamples(e.target.value)}
                  disabled={isSubmitting || success}
                  placeholder="Provide 1-2 example sentences showing usage..."
                  rows={2}
                  maxLength={500}
                  className="min-h-[80px] resize-y bg-white/10 backdrop-blur-md py-3 text-white border-[1px] border-white/20 placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20 rounded-xl shadow-lg"
                />
                <div className="absolute bottom-3 right-3 text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded-md backdrop-blur-sm">
                  {examples.length} / 500
                </div>
              </div>
              <p className="text-xs text-indigo-200/80 flex items-center gap-2 ml-1">
                <Lightbulb className="w-3 h-3" />
                Examples help others understand context
              </p>
            </div>

            {/* Info Banner */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-500/20 to-cyan-500/20 backdrop-blur-md border border-cyan-400/30 py-3 px-3 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
              <div className="relative flex gap-4">
               
                <div className="text-xs text-indigo-100 flex-1">
                  <p className="text-indigo-200/90 leading-relaxed">
                    Your term will be added to the deliberation glossary. Other participants can propose alternative definitions or endorse yours to build consensus.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-rose-500/20 to-red-500/20 backdrop-blur-md border border-rose-400/40 p-4 shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
                <div className="relative flex gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-300 flex-shrink-0" />
                  <p className="text-sm text-rose-100">{error}</p>
                </div>
              </div>
            )}

            {/* Success Display */}
            {success && (
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 backdrop-blur-md border border-emerald-400/40 p-4 shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
                <div className="relative flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0 animate-pulse" />
                  <p className="text-sm text-emerald-100">
                    Term proposed successfully! Added to glossary.
                  </p>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="relative flex items-center justify-between pt-4 mb-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="btnv2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-md border-white/20 text-white text-sm hover:bg-white/20 hover:border-white/30 transition-all"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !term.trim() || !definition.trim() || success}
                className="relative overflow-hidden btnv2 text-sm px-4 py-2.5 rounded-xl text-white
                bg-gradient-to-bl from-sky-800 to-indigo-700 hover:from-sky-800 
                hover:to-indigo-800 border-0 shadow-md shadow-indigo-300/10 
                hover:shadow-indigo-500/50 transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* Glass shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                
                <div className="relative flex items-center gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Proposing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Propose Term
                    </>
                  )}
                </div>
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

