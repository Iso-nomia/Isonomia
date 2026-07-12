"use client";

/**
 * StackEmbedCard
 * 
 * Phase 1.4 of Stacks Improvement Roadmap
 * 
 * Displays an embedded stack within another stack.
 * Shows stack name, owner, item count, and optional note.
 */

import { FolderIcon, ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface EmbeddedStackData {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  owner: { id: string; name: string; username: string };
  _count: { items: number };
}

interface StackEmbedCardProps {
  stack: EmbeddedStackData;
  note?: string | null;
  addedBy?: { id: string; name: string } | null;
  addedAt?: string | null;
  compact?: boolean;
  className?: string;
}

export function StackEmbedCard({
  stack,
  note,
  addedBy,
  addedAt,
  compact,
  className,
}: StackEmbedCardProps) {
  const href = `/stacks/${stack.slug || stack.id}`;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group block h-full rounded-lg border-2 border-dashed bg-gradient-to-br from-indigo-50/70 to-purple-50/70",
        "hover:border-primary/50 hover:from-indigo-50 hover:to-purple-50 transition-all",
        "p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-600">
          <FolderIcon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base truncate">{stack.name}</h3>
            <ExternalLinkIcon className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>

          <p className="text-sm text-muted-foreground">
            by {stack.owner.name} • {stack._count.items} items
          </p>

          {!compact && stack.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {stack.description}
            </p>
          )}

          {note && (
            <p className="mt-2 text-sm italic text-muted-foreground border-l-2 border-indigo-200 pl-2">
              &ldquo;{note}&rdquo;
            </p>
          )}

          {addedBy && addedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Added by {addedBy.name} on{" "}
              {new Date(addedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
