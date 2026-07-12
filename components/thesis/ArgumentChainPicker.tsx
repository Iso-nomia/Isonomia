// components/thesis/ArgumentChainPicker.tsx
//
// D4 Week 1–2 — modal for inserting an existing ArgumentChain into a thesis.
// Mirrors ClaimPicker (components/claims/ClaimPicker.tsx). Caller supplies
// the deliberationId; results are filtered client-side by query.

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Network, Layers, Loader2 } from "lucide-react";
import type { ChainEmbedRole } from "@/lib/tiptap/extensions/argument-chain-node";

export interface PickedChain {
  id: string;
  name: string;
  description?: string | null;
  nodeCount: number;
  edgeCount: number;
  role: ChainEmbedRole;
  caption?: string;
}

export interface ArgumentChainPickerProps {
  deliberationId: string;
  open: boolean;
  onClose: () => void;
  onPick: (chain: PickedChain) => void;
}

interface ChainListItem {
  id: string;
  name: string;
  description?: string | null;
  chainType: string;
  _count: { nodes: number; edges: number };
  creator: { id: string; name?: string | null };
  updatedAt: string;
}

const ROLE_OPTIONS: Array<{ value: ChainEmbedRole; label: string }> = [
  { value: "MAIN", label: "Main reconstruction" },
  { value: "SUPPORTING", label: "Supporting analysis" },
  { value: "OBJECTION_TARGET", label: "Objection target" },
  { value: "COMPARISON", label: "Comparison" },
];

export function ArgumentChainPicker({
  deliberationId,
  open,
  onClose,
  onPick,
}: ArgumentChainPickerProps) {
  const [chains, setChains] = useState<ChainListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<ChainEmbedRole>("MAIN");
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (!open || !deliberationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/argument-chains?deliberationId=${encodeURIComponent(deliberationId)}`,
      { credentials: "include" },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || "Failed to load chains");
        if (cancelled) return;
        setChains((json.chains ?? []) as ChainListItem[]);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, deliberationId]);

  // Reset transient picker state when reopened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedId(null);
      setRole("MAIN");
      setCaption("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chains;
    return chains.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q),
    );
  }, [chains, query]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  const handleConfirm = () => {
    if (!selected) return;
    onPick({
      id: selected.id,
      name: selected.name,
      description: selected.description ?? null,
      nodeCount: selected._count?.nodes ?? 0,
      edgeCount: selected._count?.edges ?? 0,
      role,
      caption: caption.trim() || undefined,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-lg border border-slate-200 bg-white shadow-xl mt-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-4 py-3 flex items-center gap-2">
          <Network className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Insert Argument Chain
          </h3>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4">
          {/* Left: search + list */}
          <div className="min-w-0">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chains in this deliberation…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <div className="mt-3 max-h-[60vh] overflow-y-auto border border-slate-100 rounded-md">
              {loading && (
                <div className="px-3 py-6 text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              )}
              {error && !loading && (
                <div className="px-3 py-3 text-xs text-rose-600">{error}</div>
              )}
              {!loading && !error && filtered.length === 0 && (
                <div className="px-3 py-6 text-xs text-slate-500 text-center">
                  No chains found in this deliberation.
                </div>
              )}
              {!loading && !error && filtered.length > 0 && (
                <ul className="divide-y divide-slate-100">
                  {filtered.map((c) => {
                    const isSelected = c.id === selectedId;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className={`w-full text-left px-3 py-3 transition-colors ${
                            isSelected
                              ? "bg-indigo-50"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <Layers className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-slate-900 truncate">
                                {c.name}
                              </div>
                              {c.description && (
                                <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                                  {c.description}
                                </div>
                              )}
                              <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                                <span>{c.chainType}</span>
                                <span>•</span>
                                <span>
                                  {c._count?.nodes ?? 0} nodes ·{" "}
                                  {c._count?.edges ?? 0} edges
                                </span>
                                {c.creator?.name && (
                                  <>
                                    <span>•</span>
                                    <span>by {c.creator.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right: insertion options */}
          <div className="border border-slate-100 rounded-md p-3 bg-slate-50/50 self-start">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
              Insertion options
            </div>

            <label className="block text-xs text-slate-600 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ChainEmbedRole)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <label className="block text-xs text-slate-600 mt-3 mb-1">
              Description (optional)
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              placeholder="Why this chain matters here…"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white resize-none"
            />

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={!selected}
                onClick={handleConfirm}
                className="w-full rounded-md bg-indigo-600 text-white text-sm font-medium px-3 py-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Insert
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-3 py-2 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArgumentChainPicker;
