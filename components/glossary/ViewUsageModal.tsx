// components/glossary/ViewUsageModal.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Eye, MessageSquare, FileText, ExternalLink, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";

interface ViewUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  termId: string;
  termName: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ViewUsageModal({ isOpen, onClose, termId, termName }: ViewUsageModalProps) {
  const { data, error, isLoading } = useSWR(
    isOpen ? `/api/glossary/terms/${termId}/usage` : null,
    fetcher
  );

  const targetTypeConfig = {
    claim: {
      label: "Claim",
      icon: MessageSquare,
      color: "text-cyan-200",
      bg: "bg-cyan-500/20",
      border: "border-cyan-400/40"
    },
    argument: {
      label: "Argument",
      icon: FileText,
      color: "text-indigo-200",
      bg: "bg-indigo-500/20",
      border: "border-indigo-400/40"
    },
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden bg-slate-900/95 backdrop-blur-xl border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 shadow-lg">
              <Eye className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <div className="text-white">Term Usage</div>
              <div className="text-sm font-normal text-cyan-200/80 mt-0.5">
                Where &quot;{termName}&quot; appears in this deliberation
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto pr-2 max-h-[60vh] custom-scrollbar">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-rose-300">
              <p>Failed to load usage data</p>
              <p className="text-sm text-rose-200/60 mt-1">{error.message}</p>
            </div>
          )}

          {data && data.usages && data.usages.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No usage found</p>
              <p className="text-sm text-slate-500 mt-1">
                This term hasn&apos;t been referenced in any claims or arguments yet
              </p>
            </div>
          )}

          {data && data.usages && data.usages.length > 0 && (
            <div className="space-y-4 pb-4">
              {data.usages.map((usage: any) => {
                const config = targetTypeConfig[usage.targetType as keyof typeof targetTypeConfig] 
                  || targetTypeConfig.claim;
                const Icon = config.icon;

                return (
                  <div
                    key={usage.id}
                    className={cn(
                      "relative overflow-hidden rounded-xl border backdrop-blur-md shadow-lg p-4 group",
                      "bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-white/10",
                      "hover:border-cyan-400/40 transition-all duration-300 cursor-pointer"
                    )}
                  >
                    {/* Glass shine */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    
                    <div className="relative space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded-lg backdrop-blur-sm",
                            config.bg
                          )}>
                            <Icon className={cn("w-4 h-4", config.color)} />
                          </div>
                          <span className={cn(
                            "px-2 py-1 rounded-md text-xs font-semibold border backdrop-blur-sm",
                            config.bg,
                            config.border,
                            config.color
                          )}>
                            {config.label}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            // TODO: Navigate to the claim/argument
                            console.log("Navigate to:", usage.targetType, usage.targetId);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium text-cyan-200 transition-all backdrop-blur-sm"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View
                        </button>
                      </div>

                      {/* Context text */}
                      <div className="pl-3 border-l-2 border-cyan-400/40 bg-slate-700/30 rounded-r-lg p-3">
                        <p className="text-sm text-white/90 leading-relaxed">
                          {usage.contextText}
                        </p>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-3 text-xs text-slate-400 pt-2 border-t border-white/10">
                        <div>
                          Created {new Date(usage.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })}
                        </div>
                        <div className="w-1 h-1 rounded-full bg-slate-500" />
                        <div className="font-mono text-slate-500">
                          ID: {usage.targetId.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary footer */}
        {data && data.usages && data.usages.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {data.usages.length} {data.usages.length === 1 ? "reference" : "references"} found
              </span>
            </div>
            <div className="flex items-center gap-2">
              {data.usages.filter((u: any) => u.targetType === "claim").length > 0 && (
                <div className="px-2 py-1 rounded-md bg-cyan-500/20 text-cyan-200 border border-cyan-400/40">
                  {data.usages.filter((u: any) => u.targetType === "claim").length} claims
                </div>
              )}
              {data.usages.filter((u: any) => u.targetType === "argument").length > 0 && (
                <div className="px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-200 border border-indigo-400/40">
                  {data.usages.filter((u: any) => u.targetType === "argument").length} arguments
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
