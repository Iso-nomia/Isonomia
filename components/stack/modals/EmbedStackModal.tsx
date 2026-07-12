"use client";

/**
 * EmbedStackModal
 * 
 * Phase 1.4 of Stacks Improvement Roadmap
 * 
 * Modal for selecting and embedding another stack as an item.
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchIcon, FolderIcon, AlertCircleIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmbedStackModalProps {
  open: boolean;
  onClose: () => void;
  parentStackId: string;
  onSuccess?: () => void;
}

interface EmbeddableStack {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  isPublic: boolean;
  isOwner: boolean;
  owner: { id: string; name: string; username: string };
  _count: { items: number };
}

export function EmbedStackModal({
  open,
  onClose,
  parentStackId,
  onSuccess,
}: EmbedStackModalProps) {
  const [search, setSearch] = useState("");
  const [stacks, setStacks] = useState<EmbeddableStack[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadStacks();
      setSelected(null);
      setNote("");
      setError(null);
    }
  }, [open]);

  const loadStacks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stacks/embeddable?excludeId=${parentStackId}`);
      if (!res.ok) throw new Error("Failed to load stacks");
      const data = await res.json();
      setStacks(data.stacks);
    } catch (err) {
      setError("Failed to load stacks");
    } finally {
      setLoading(false);
    }
  };

  const handleEmbed = async () => {
    if (!selected) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/stacks/${parentStackId}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedStackId: selected, note: note || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to embed stack");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredStacks = stacks.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedStack = stacks.find((s) => s.id === selected);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Embed a Stack</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Add another stack as an item in this stack
          </p>
        </DialogHeader>

        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search stacks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : filteredStacks.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {search ? "No matching stacks" : "No stacks available to embed"}
            </div>
          ) : (
            filteredStacks.map((stack) => (
              <button
                key={stack.id}
                onClick={() => setSelected(stack.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                  selected === stack.id
                    ? "bg-indigo-50 border border-indigo-300"
                    : "hover:bg-muted"
                )}
              >
                <FolderIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{stack.name}</div>
                  <div className="text-xs text-muted-foreground">
                    by {stack.owner.name} • {stack._count?.items ?? 0} items
                    {stack.isOwner && (
                      <span className="ml-2 text-indigo-600">• Yours</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="mb-4">
            <Textarea
              placeholder="Add a note about why you're embedding this stack... (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 mb-4">
            <AlertCircleIcon className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleEmbed}
            disabled={!selected || saving}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white",
              "hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center gap-2"
            )}
          >
            {saving && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Embedding..." : "Embed Stack"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
