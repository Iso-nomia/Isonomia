// components/claims/ClaimPicker.tsx
"use client";

import React, { useState, useEffect } from "react";

interface ClaimPickerProps {
  deliberationId: string;
  open: boolean;
  onClose: () => void;
  onPick: (claim: SearchResult) => void;
  allowCreate?: boolean;
}

interface SearchResult {
  id: string;
  text: string;
  position?: "IN" | "OUT" | "UNDEC";
  author?: { name: string };
}

/**
 * ClaimPicker: Modal for searching and selecting claims.
 * Matches the pattern from SchemeComposerPicker and EntityPicker.
 */
export function ClaimPicker({
  deliberationId,
  open,
  onClose,
  onPick,
  allowCreate = false,
}: ClaimPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Debounced search effect
  useEffect(() => {
    if (!open) return;

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/claims/search?deliberationId=${deliberationId}&q=${encodeURIComponent(query)}`
        );
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        setResults(data.claims || []);
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [open, query, deliberationId]);

  // Handle claim selection
  const handleSelect = (claim: SearchResult) => {
    onPick(claim);
    onClose();
    setQuery("");
    setResults([]);
  };

  // Handle creating a new claim
  const handleCreateClaim = async () => {
    if (!query.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: query.trim(),
          deliberationId,
        }),
      });

      if (!response.ok) throw new Error("Failed to create claim");
      const data = await response.json();
      // API returns { claim, created }
      handleSelect(data.claim);
    } catch (err) {
      console.error("Create claim error:", err);
    } finally {
      setIsCreating(false);
    }
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

  // Render position badge
  const renderPositionBadge = (position?: "IN" | "OUT" | "UNDEC") => {
    if (!position) return null;

    const colors = {
      IN: "bg-emerald-100 text-emerald-800 border-emerald-300",
      OUT: "bg-rose-100 text-rose-800 border-rose-300",
      UNDEC: "bg-slate-100 text-slate-700 border-slate-300",
    };

    return (
      <span
        className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[position]}`}
      >
        {position}
      </span>
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/20 flex items-start justify-center p-6"
      onClick={onClose}
    >
      <div
        className="min-w-[500px] max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Insert Claim</h3>
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
            placeholder="Search claims..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {/* Results */}
          <div className="mt-3 max-h-80 overflow-y-auto">
            {loading && (
              <div className="px-3 py-2 text-xs text-slate-500">Searching…</div>
            )}

            {!loading && query.trim() && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500">No claims found</div>
            )}

            {!loading && !query.trim() && (
              <div className="px-3 py-2 text-xs text-slate-500">
                Start typing to search claims
              </div>
            )}

            {!loading && results.length > 0 && (
              <ul className="divide-y divide-slate-100 border-t border-b border-slate-100">
                {results.map((claim) => (
                  <li key={claim.id}>
                    <button
                      className="w-full text-left px-3 py-3 hover:bg-slate-50 transition-colors"
                      onClick={() => handleSelect(claim)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 text-sm text-slate-900">
                          {claim.text}
                        </div>
                        {renderPositionBadge(claim.position)}
                      </div>
                      {claim.author && (
                        <div className="mt-1 text-xs text-slate-500">
                          by {claim.author.name}
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-slate-400 font-mono">
                        {claim.id}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Create new claim option */}
          {allowCreate && query.trim() && !loading && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <button
                onClick={handleCreateClaim}
                disabled={isCreating}
                className="w-full rounded-md border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center">
                  <span className="mr-2 text-lg">+</span>
                  <span>
                    {isCreating ? "Creating..." : `Create new claim: "${query.trim()}"`}
                  </span>
                </div>
              </button>
            </div>
          )}

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
