// components/glossary/ViewHistoryModal.tsx
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, History, User, Clock, Edit3, Plus, CheckCircle2, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";

interface ViewHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  termId: string;
  termName: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ViewHistoryModal({ isOpen, onClose, termId, termName }: ViewHistoryModalProps) {
  const { data, error, isLoading } = useSWR(
    isOpen ? `/api/glossary/terms/${termId}/history` : null,
    fetcher
  );

  const changeTypeConfig = {
    created: { 
      label: "Created", 
      icon: Plus, 
      color: "text-cyan-200",
      bg: "bg-cyan-500/20",
      border: "border-cyan-400/40"
    },
    edited: { 
      label: "Edited", 
      icon: Edit3, 
      color: "text-indigo-200",
      bg: "bg-indigo-500/20",
      border: "border-indigo-400/40"
    },
    merged: { 
      label: "Merged", 
      icon: CheckCircle2, 
      color: "text-purple-200",
      bg: "bg-purple-500/20",
      border: "border-purple-400/40"
    },
    endorsed: { 
      label: "Endorsed", 
      icon: CheckCircle2, 
      color: "text-emerald-200",
      bg: "bg-emerald-500/20",
      border: "border-emerald-400/40"
    },
    canonical_promoted: { 
      label: "Promoted to Canonical", 
      icon: Award, 
      color: "text-yellow-200",
      bg: "bg-yellow-500/20",
      border: "border-yellow-400/40"
    },
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden bg-slate-900/95 backdrop-blur-xl border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 shadow-lg">
              <History className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <div className="text-white">Definition History</div>
              <div className="text-sm font-normal text-cyan-200/80 mt-0.5">
                {termName}
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
              <p>Failed to load history</p>
              <p className="text-sm text-rose-200/60 mt-1">{error.message}</p>
            </div>
          )}

          {data && data.history && data.history.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No edit history available</p>
              <p className="text-sm text-slate-500 mt-1">
                This definition hasn&apos;t been modified since creation
              </p>
            </div>
          )}

          {data && data.history && data.history.length > 0 && (
            <div className="space-y-6 pb-4">
              {/* Timeline */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[17px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-cyan-400/40 via-indigo-400/40 to-purple-400/40" />
                
                <div className="space-y-6">
                  {data.history.map((entry: any, index: number) => {
                    const config = changeTypeConfig[entry.changeType as keyof typeof changeTypeConfig] 
                      || changeTypeConfig.edited;
                    const Icon = config.icon;

                    return (
                      <div key={entry.id} className="relative flex gap-4">
                        {/* Timeline dot */}
                        <div className={cn(
                          "relative z-10 flex items-center justify-center w-9 h-9 rounded-full border-2 shadow-lg backdrop-blur-sm",
                          config.bg,
                          config.border
                        )}>
                          <Icon className={cn("w-4 h-4", config.color)} />
                        </div>

                        {/* Content card */}
                        <div className="flex-1 -mt-1">
                          <div className={cn(
                            "relative overflow-hidden rounded-xl border backdrop-blur-md shadow-lg p-4",
                            "bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-white/10"
                          )}>
                            {/* Glass shine */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
                            
                            <div className="relative space-y-3">
                              {/* Header */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "px-2 py-1 rounded-md text-xs font-semibold border backdrop-blur-sm",
                                    config.bg,
                                    config.border,
                                    config.color
                                  )}>
                                    {config.label}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                  <Clock className="w-3 h-3" />
                                  {new Date(entry.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </div>
                              </div>

                              {/* Author */}
                              <div className="flex items-center gap-2 text-sm">
                                <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-400/20 to-cyan-400/20">
                                  <User className="w-3.5 h-3.5 text-cyan-200" />
                                </div>
                                <span className="text-white/90">
                                  {entry.changedBy?.name || "Unknown User"}
                                </span>
                              </div>

                              {/* Changes (if edited) */}
                              {entry.changeType === "edited" && (
                                <div className="space-y-3 pt-2">
                                  {/* Previous text */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
                                      <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                      Previous
                                    </div>
                                    <div className="pl-3 border-l-2 border-rose-400/40 bg-rose-500/10 rounded-r-lg p-3">
                                      <p className="text-sm text-white/80 leading-relaxed line-through decoration-rose-400/60">
                                        {entry.previousText}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Arrow */}
                                  <div className="flex items-center justify-center">
                                    <div className="px-3 py-1 rounded-full bg-gradient-to-r from-rose-500/20 to-emerald-500/20 border border-white/10 text-xs text-white/60">
                                      →
                                    </div>
                                  </div>

                                  {/* New text */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      New
                                    </div>
                                    <div className="pl-3 border-l-2 border-emerald-400/40 bg-emerald-500/10 rounded-r-lg p-3">
                                      <p className="text-sm text-white/90 leading-relaxed">
                                        {entry.newText}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Created/merged/promoted - just show new text */}
                              {entry.changeType !== "edited" && (
                                <div className="pt-2">
                                  <div className="pl-3 border-l-2 border-cyan-400/40 bg-slate-700/30 rounded-r-lg p-3">
                                    <p className="text-sm text-white/90 leading-relaxed">
                                      {entry.newText}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
