// components/arguments/ArgumentPicker.tsx
"use client";

import React, { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";

interface ArgumentPickerProps {
  deliberationId: string;
  open: boolean;
  onClose: () => void;
  onPick: (argument: SearchResult) => void;
}

interface SearchResult {
  id: string;
  text: string;
  aif?: {
    scheme?: {
      id: string;
      key: string;
      name: string;
    } | null;
    conclusion?: {
      id: string;
      text: string;
    } | null;
    premises?: Array<{
      id: string;
      text: string;
      isImplicit?: boolean;
    }> | null;
  };
}

/**
 * ArgumentPicker: Modal for searching and selecting arguments.
 * Matches the pattern from ClaimPicker and SchemeComposerPicker.
 */
export function ArgumentPicker({
  deliberationId,
  open,
  onClose,
  onPick,
}: ArgumentPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced search effect
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/deliberations/${deliberationId}/arguments/aif?limit=50`
        );
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        
        // Filter results based on query if provided
        let items = data.items || [];
        if (query.trim()) {
          const lowerQuery = query.toLowerCase();
          items = items.filter((arg: SearchResult) => 
            arg.text.toLowerCase().includes(lowerQuery) ||
            arg.aif?.scheme?.name?.toLowerCase().includes(lowerQuery) ||
            arg.aif?.conclusion?.text?.toLowerCase().includes(lowerQuery)
          );
        }
        
        setResults(items);
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, query.trim() ? 200 : 0); // No delay if empty query (load all on open)

    return () => clearTimeout(timeout);
  }, [open, query, deliberationId]);

  // Handle argument selection
  const handleSelect = (argument: SearchResult) => {
    onPick(argument);
    onClose();
    setQuery("");
    setResults([]);
  };

  // Keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && results.length === 1) {
      e.preventDefault();
      handleSelect(results[0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/20 flex items-start justify-center p-6"
      onClick={onClose}
    >
      <div
        className="min-w-[600px] max-w-3xl rounded-lg border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Insert Argument</h3>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Search input */}
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search arguments..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {/* Results */}
          <div className="mt-3 max-h-[500px] overflow-y-auto">
            {loading && (
              <div className="px-3 py-2 text-xs text-slate-500">Searching…</div>
            )}

            {!loading && query.trim() && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500">No arguments found</div>
            )}

            {!loading && !query.trim() && (
              <div className="px-3 py-2 text-xs text-slate-500">
                Start typing to search arguments
              </div>
            )}

            {!loading && results.length > 0 && (
              <ul className="divide-y divide-slate-100 border-t border-b border-slate-100">
                {results.map((argument) => (
                  <li key={argument.id}>
                    <button
                      className="w-full text-left px-4 py-4 hover:bg-slate-50 transition-colors"
                      onClick={() => handleSelect(argument)}
                    >
                      {/* Main argument text */}
                      <div className="text-sm text-slate-900 leading-relaxed mb-2">
                        {argument.text}
                      </div>

                      {/* Scheme badge */}
                      {argument.aif?.scheme && (
                        <div className="mb-2">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {argument.aif.scheme.name || argument.aif.scheme.key}
                          </span>
                        </div>
                      )}

                      {/* Premises → Conclusion flow */}
                      {(argument.aif?.premises && argument.aif.premises.length > 0) || argument.aif?.conclusion ? (
                        <div className="mt-2 text-xs text-slate-600 space-y-1">
                          {argument.aif.premises && argument.aif.premises.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="font-medium text-slate-500 shrink-0">Premises:</span>
                              <div className="flex-1">
                                {argument.aif.premises.map((p, idx) => (
                                  <div key={p.id} className="flex items-start gap-1">
                                    <span className="text-slate-400">•</span>
                                    <span className="line-clamp-1">{p.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {argument.aif.conclusion && (
                            <div className="flex items-start gap-2">
                              <ChevronRight className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                              <span className="font-medium text-emerald-700 line-clamp-1">
                                {argument.aif.conclusion.text}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : null}

                      {/* Argument ID */}
                      <div className="mt-2 text-[11px] text-slate-400 font-mono">
                        {argument.id}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
