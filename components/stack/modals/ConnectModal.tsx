"use client";

/**
 * ConnectModal
 * 
 * Phase 1.3 of Stacks Improvement Roadmap
 * 
 * Modal for connecting a block to multiple stacks.
 * Shows user's owned + collaborator stacks with checkboxes.
 */

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchIcon, FolderIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectModalProps {
  open: boolean;
  onClose: () => void;
  blockId: string;
  blockTitle: string;
  currentStackIds: string[];
  onUpdate?: () => void;
}

interface StackOption {
  id: string;
  name: string;
  slug: string | null;
  itemCount: number;
  isOwner: boolean;
  isConnected: boolean;
}

export function ConnectModal({
  open,
  onClose,
  blockId,
  blockTitle,
  currentStackIds,
  onUpdate,
}: ConnectModalProps) {
  const [search, setSearch] = useState("");
  const [stacks, setStacks] = useState<StackOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(currentStackIds));
  const [notes, setNotes] = useState<Record<string, string>>({}); // Notes per stack
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadStacks();
      setSelected(new Set(currentStackIds));
      setNotes({});
      setError(null);
    }
  }, [open, currentStackIds]);

  const loadStacks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stacks/my?includeCollaborator=true");
      if (!res.ok) throw new Error("Failed to load stacks");
      const data = await res.json();

      setStacks(
        data.stacks.map((s: any) => ({
          ...s,
          isConnected: currentStackIds.includes(s.id),
        }))
      );
    } catch (err) {
      setError("Failed to load your stacks");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (stackId: string) => {
    const next = new Set(selected);
    if (next.has(stackId)) {
      next.delete(stackId);
    } else {
      next.add(stackId);
    }
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Find stacks to add and remove
      const toAdd = [...selected].filter((id) => !currentStackIds.includes(id));
      const toRemove = currentStackIds.filter((id) => !selected.has(id));

      // Process additions with notes
      for (const stackId of toAdd) {
        const res = await fetch(`/api/stacks/${stackId}/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockId, note: notes[stackId] || undefined }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to connect");
        }
      }

      // Process removals
      for (const stackId of toRemove) {
        const res = await fetch(`/api/stacks/${stackId}/disconnect/${blockId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to disconnect");
        }
      }

      onUpdate?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save connections");
    } finally {
      setSaving(false);
    }
  };

  const filteredStacks = stacks.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const hasChanges =
    [...selected].some((id) => !currentStackIds.includes(id)) ||
    currentStackIds.some((id) => !selected.has(id));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Connect to Stacks</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select stacks to connect &ldquo;{blockTitle}&rdquo;
          </p>
        </DialogHeader>

        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your stacks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {error && (
          <div className="mb-4 p-2 text-sm text-red-600 bg-red-50 rounded border border-red-200">
            {error}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Loading stacks...
            </div>
          ) : filteredStacks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No matching stacks" : "No stacks found"}
            </div>
          ) : (
            filteredStacks.map((stack) => {
              const isNewlySelected = selected.has(stack.id) && !currentStackIds.includes(stack.id);
              return (
                <div key={stack.id} className="space-y-1">
                  <label
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer",
                      selected.has(stack.id) && "bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={selected.has(stack.id)}
                      onCheckedChange={() => handleToggle(stack.id)}
                    />
                    <FolderIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{stack.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {stack.itemCount} items
                        {stack.isConnected && (
                          <span className="ml-2 text-primary">• Connected</span>
                        )}
                        {!stack.isOwner && (
                          <span className="ml-2 text-amber-600">• Collaborator</span>
                        )}
                      </div>
                    </div>
                  </label>
                  {/* Note input for newly selected stacks */}
                  {isNewlySelected && (
                    <div className="ml-9 mr-2">
                      <Input
                        placeholder="Add a note (optional)..."
                        value={notes[stack.id] || ""}
                        onChange={(e) => setNotes({ ...notes, [stack.id]: e.target.value })}
                        className="text-xs h-8"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={cn(
              "px-3 py-1.5 btnv2 text-sm rounded-md",
              "hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center gap-2"
            )}
          >
            {saving && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Saving..." : "Save Connections"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
