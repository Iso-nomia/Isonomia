// components/glossary/GlossaryTermModal.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TermCard } from "./TermCard";
import { Loader2, BookOpen, AlertCircle } from "lucide-react";
import useSWR from "swr";

interface GlossaryTermModalProps {
  isOpen: boolean;
  onClose: () => void;
  termId: string;
  termName: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function GlossaryTermModal({ isOpen, onClose, termId, termName }: GlossaryTermModalProps) {
  // Fetch full term data when modal opens
  const { data, error, isLoading, mutate } = useSWR(
    isOpen ? `/api/glossary/terms/${termId}` : null,
    fetcher
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden bg-slate-900/95 backdrop-blur-xl border-white/20 text-white p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 shadow-lg">
              <BookOpen className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <div className="text-white">Glossary Term</div>
              <div className="text-sm font-normal text-cyan-200/80 mt-0.5">
                {termName}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto px-6 pb-6 max-h-[calc(85vh-100px)] custom-scrollbar">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-400" />
              <p className="text-rose-300">Failed to load term</p>
              <p className="text-sm text-rose-200/60 mt-1">{error.message}</p>
            </div>
          )}

          {data && data.term && (
            <TermCard
              term={data.term}
              isSelected={false}
              onSelect={() => {}}
              onUpdate={() => mutate()}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
