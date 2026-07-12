"use client";

/**
 * ContextsPanel
 * 
 * Phase 1.3 of Stacks Improvement Roadmap
 * 
 * Sheet panel showing all stacks a block appears in ("contexts").
 * Displays connection metadata like who added it, when, and any notes.
 */

import { useState, useEffect } from "react";
import { Link2Icon, ExternalLinkIcon, Loader2Icon, CalendarIcon, UserIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Link from "next/link";

interface ContextsPanelProps {
  open: boolean;
  onClose: () => void;
  blockId: string;
  blockTitle: string;
}

interface StackContext {
  stackId: string;
  stackName: string;
  stackSlug: string | null;
  owner: { id: string; name: string; username: string };
  itemCount: number;
  addedBy: { id: string; name: string } | null;
  addedAt: string;
  note: string | null;
}

export function ContextsPanel({
  open,
  onClose,
  blockId,
  blockTitle,
}: ContextsPanelProps) {
  const [contexts, setContexts] = useState<StackContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadContexts();
    }
  }, [open, blockId]);

  const loadContexts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/blocks/${blockId}/contexts`);
      if (!res.ok) throw new Error("Failed to load contexts");
      const data = await res.json();
      setContexts(data.contexts);
    } catch (err) {
      setError("Failed to load connections");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Link2Icon className="h-5 w-5" />
            Connections
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            &ldquo;{blockTitle}&rdquo; appears in{" "}
            {loading ? "..." : contexts.length} stack
            {contexts.length !== 1 ? "s" : ""}
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Loading connections...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : contexts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Not connected to any stacks yet
            </div>
          ) : (
            contexts.map((ctx) => (
              <Link
                key={ctx.stackId}
                href={`/stacks/${ctx.stackSlug || ctx.stackId}`}
                className="block p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{ctx.stackName}</h4>
                    <p className="text-sm text-muted-foreground">
                      by {ctx.owner.name} • {ctx.itemCount} items
                    </p>
                  </div>
                  <ExternalLinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>

                {ctx.note && (
                  <div className="mt-2 p-2 bg-muted/50 rounded text-sm italic text-muted-foreground">
                    &ldquo;{ctx.note}&rdquo;
                  </div>
                )}

                {ctx.addedBy && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <UserIcon className="h-3 w-3" />
                      {ctx.addedBy.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {formatDate(ctx.addedAt)}
                    </span>
                  </div>
                )}
              </Link>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
