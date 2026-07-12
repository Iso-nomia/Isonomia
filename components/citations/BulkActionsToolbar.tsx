// components/citations/BulkActionsToolbar.tsx
// Phase 2.4: Toolbar for bulk citation operations

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Trash2Icon,
  TagIcon,
  StarIcon,
  ChevronDownIcon,
  XIcon,
  Loader2Icon,
} from "lucide-react";
import { allIntents, CitationIntentType } from "./IntentSelector";
import { cn } from "@/lib/utils";

interface BulkActionsToolbarProps {
  selectedCount: number;
  onDelete: () => Promise<void>;
  onChangeIntent: (intent: CitationIntentType | null) => Promise<void>;
  onChangeRelevance: (relevance: number) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

export function BulkActionsToolbar({
  selectedCount,
  onDelete,
  onChangeIntent,
  onChangeRelevance,
  onCancel,
  className,
}: BulkActionsToolbarProps) {
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteDialogOpen(false);
    await handleAction(onDelete);
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20",
          className
        )}
      >
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>

        <div className="flex-1" />

        {/* Set Intent */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={loading}>
              <TagIcon className="h-4 w-4 mr-1" />
              Set Intent
              <ChevronDownIcon className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {allIntents.map((intent) => (
              <DropdownMenuItem
                key={intent.value}
                onClick={() => handleAction(() => onChangeIntent(intent.value))}
                className="flex items-center gap-2"
              >
                <intent.icon className={cn("h-4 w-4", intent.color)} />
                {intent.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleAction(() => onChangeIntent(null))}
              className="text-muted-foreground"
            >
              <XIcon className="h-4 w-4 mr-2" />
              Clear Intent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Set Relevance */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={loading}>
              <StarIcon className="h-4 w-4 mr-1" />
              Relevance
              <ChevronDownIcon className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {[5, 4, 3, 2, 1].map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => handleAction(() => onChangeRelevance(r))}
                className="flex items-center gap-2"
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-2 h-2 rounded-full",
                        i < r ? "bg-primary" : "bg-muted"
                      )}
                    />
                  ))}
                </div>
                <span className="ml-2">{r} star{r !== 1 ? "s" : ""}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Delete */}
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => setDeleteDialogOpen(true)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2Icon className="h-4 w-4 mr-1" />
          Delete
        </Button>

        {/* Cancel selection */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={loading}
        >
          <XIcon className="h-4 w-4" />
        </Button>

        {/* Loading indicator */}
        {loading && (
          <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedCount} citation{selectedCount !== 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The selected citations will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
