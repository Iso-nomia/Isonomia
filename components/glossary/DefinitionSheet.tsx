// components/glossary/DefinitionSheet.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TermCard } from "./TermCard";
import { ProposeTermModal } from "./ProposeTermModal";
import { ExportGlossaryButton } from "./ExportGlossaryButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface DefinitionSheetProps {
  deliberationId: string;
  selectedTermId?: string;
  onTermSelect?: (termId: string) => void;
}

export function DefinitionSheet({
  deliberationId,
  selectedTermId,
  onTermSelect,
}: DefinitionSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"usage" | "alphabetical" | "recent">("usage");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [proposeModalOpen, setProposeModalOpen] = useState(false);

  // Fetch terms
  const { data, mutate, isLoading } = useSWR(
    `/api/deliberations/${deliberationId}/glossary/terms?status=${filterStatus}&sort=${sortBy}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  const terms = data?.terms || [];

  // Filter by search query (client-side for responsiveness)
  const filteredTerms = useMemo(() => {
    if (!searchQuery.trim()) return terms;
    const query = searchQuery.toLowerCase();
    return terms.filter((term: any) =>
      term.term.toLowerCase().includes(query)
    );
  }, [terms, searchQuery]);

  // Listen for glossary updates
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail.deliberationId === deliberationId) {
        mutate();
      }
    };
    window.addEventListener("glossary:updated", handler as any);
    return () => window.removeEventListener("glossary:updated", handler as any);
  }, [deliberationId, mutate]);

  return (
    <div className="flex flex-col h-full mt-[-6px]">
      {/* Header */}
      <div className="flex-shrink-0 space-y-4 mb-4">
        <div className="flex items-center justify-between border-b border-slate-100/50 pb-3">
          <div className="flex gap-3 tracking-wide  items-center ">
            <h2 className="text-lg font-bold text-slate-100">Glossary</h2>
            <p className="text-sm text-slate-100 ">•</p>
            <p className="text-sm text-slate-100">
              {filteredTerms.length} {filteredTerms.length === 1 ? " term" : " terms"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ExportGlossaryButton 
              deliberationId={deliberationId}
              terms={terms}
            />
            <button
              onClick={() => setProposeModalOpen(true)}
              className="btnv2 rounded-xl px-3 py-2 text-xs text-white"
            >
              + Define a New Term
            </button>
          </div>
        </div>
<div className="flex gap-4 ">
        {/* Search */}
        <Input
          type="search"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-0 h-fit px-2.5 py-1.5 rounded-xl articlesearchfield bg-slate-500/20 text-white placeholder:text-slate-100/80"
        />

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-[140px] h-fit rounded-xl text-xs px-2 py-2 bg-slate-700 btnv2--ghost text-white ">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usage">Most Used</SelectItem>
              <SelectItem value="alphabetical">A-Z</SelectItem>
              <SelectItem value="recent">Recent</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-fit rounded-xl text-xs px-2 py-2 bg-slate-700 btnv2--ghost text-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="CONSENSUS">Consensus</SelectItem>
              <SelectItem value="CONTESTED">Contested</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div>
      </div>

      {/* Terms List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : filteredTerms.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="w-12 h-12 text-slate-300 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <div className="text-sm text-slate-600 font-medium mb-1">
              No terms defined yet
            </div>
            <div className="text-xs text-slate-500">
              {searchQuery.trim()
                ? "Try a different search"
                : "Propose the first term to get started"}
            </div>
          </div>
        ) : (
          filteredTerms.map((term: any) => (
            <TermCard
              key={term.id}
              term={term}
              isSelected={selectedTermId === term.id}
              onSelect={() => onTermSelect?.(term.id)}
              onUpdate={() => mutate()}
            />
          ))
        )}
      </div>

      {/* Propose Term Modal */}
      <ProposeTermModal
        deliberationId={deliberationId}
        open={proposeModalOpen}
        onOpenChange={setProposeModalOpen}
        onProposed={() => {
          mutate();
          // Broadcast event
          window.dispatchEvent(
            new CustomEvent("glossary:updated", {
              detail: { deliberationId },
            })
          );
        }}
      />
    </div>
  );
}
