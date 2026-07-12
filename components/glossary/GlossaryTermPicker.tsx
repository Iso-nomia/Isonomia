// components/glossary/GlossaryTermPicker.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Search, Loader2, CheckCircle2, AlertCircle, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createGlossaryLinkSyntax } from "@/lib/glossary/parseGlossaryLinks";
import useSWR from "swr";

interface GlossaryTermPickerProps {
  deliberationId: string;
  onSelectTerm: (syntax: string, term: any) => void;
  selectedText?: string;
  className?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function GlossaryTermPicker({ 
  deliberationId, 
  onSelectTerm, 
  selectedText,
  className 
}: GlossaryTermPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(selectedText || "");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useSWR(
    isOpen ? `/api/deliberations/${deliberationId}/glossary/terms?status=all&sort=alphabetical` : null,
    fetcher
  );

  const terms = data?.terms || [];

  const filteredTerms = searchQuery.trim()
    ? terms.filter((term: any) =>
        term.term.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : terms;

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectTerm = (term: any) => {
    const syntax = createGlossaryLinkSyntax(term.id, term.term);
    onSelectTerm(syntax, term);
    setIsOpen(false);
    setSearchQuery("");
  };

  const statusConfig = {
    CONSENSUS: { 
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/20",
      border: "border-emerald-400/40"
    },
    CONTESTED: { 
      icon: AlertCircle,
      color: "text-orange-400",
      bg: "bg-orange-500/20",
      border: "border-orange-400/40"
    },
    PENDING: { 
      icon: Clock,
      color: "text-slate-400",
      bg: "bg-slate-500/20",
      border: "border-slate-400/40"
    },
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
     
       
        onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 menuv2--lite rounded-lg p-1"
      >
         <>
        <BookOpen className="w-3 h-3" />
              <span className="text-xs">Link Term</span>
              </>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 z-50 bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl overflow-hidden">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search glossary terms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-800/60 border-white/20 text-white placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="ml-2 p-1.5 rounded-md hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              </div>
            )}

            {!isLoading && filteredTerms.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">
                  {searchQuery ? "No matching terms found" : "No terms in glossary"}
                </p>
              </div>
            )}

            {!isLoading && filteredTerms.length > 0 && (
              <div className="p-2 space-y-1">
                {filteredTerms.map((term: any) => {
                  const config = statusConfig[term.status as keyof typeof statusConfig] || statusConfig.PENDING;
                  const StatusIcon = config.icon;

                  return (
                    <button
                      key={term.id}
                      type="button"
                      onClick={() => handleSelectTerm(term)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors border border-transparent hover:border-white/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("p-1.5 rounded-md mt-0.5", config.bg)}>
                          <StatusIcon className={cn("w-3.5 h-3.5", config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-sm">
                            {term.term}
                          </div>
                          {term.definitions && term.definitions.length > 0 && (
                            <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                              {term.definitions.find((d: any) => d.isCanonical)?.definition || 
                               term.definitions[0]?.definition}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", config.bg, config.border, config.color)}>
                              {term.status}
                            </span>
                            {term.definitions && (
                              <span className="text-[10px] text-slate-500">
                                {term.definitions.length} {term.definitions.length === 1 ? "definition" : "definitions"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!isLoading && filteredTerms.length > 0 && (
            <div className="p-2 border-t border-white/10 bg-slate-800/40">
              <p className="text-xs text-slate-400 text-center">
                Click a term to insert a link
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
