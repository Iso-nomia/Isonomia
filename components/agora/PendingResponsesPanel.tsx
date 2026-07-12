// components/agora/PendingResponsesPanel.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users } from "lucide-react";
import { PendingResponsesList } from "./PendingResponsesList";
import useSWR from "swr";

// ============================================================================
// TYPES
// ============================================================================

export interface PendingResponsesPanelProps {
  deliberationId: string;
  variant?: "button" | "inline";
  onResponseHandled?: () => void;
}

// ============================================================================
// FETCHER
// ============================================================================

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PendingResponsesPanel - Shows pending non-canonical responses for authors to review
 * 
 * Usage:
 * 
 * 1. Button variant (opens modal):
 *    <PendingResponsesPanel deliberationId="..." variant="button" />
 * 
 * 2. Inline variant (embedded in page):
 *    <PendingResponsesPanel deliberationId="..." variant="inline" />
 */
export function PendingResponsesPanel({
  deliberationId,
  variant = "button",
  onResponseHandled,
}: PendingResponsesPanelProps) {
  const [open, setOpen] = useState(false);

  // Fetch pending count for badge
  const { data } = useSWR(
    `/api/non-canonical/pending?deliberationId=${deliberationId}`,
    fetcher,
    { refreshInterval: 15000 } // Refresh every 15 seconds
  );

  const pendingCount = data?.pendingCount || 0;

  // ─── Inline Variant ─────────────────────────────────────────
  if (variant === "inline") {
    return (
      <div className="w-full">
        <PendingResponsesList
          deliberationId={deliberationId}
          onResponseHandled={onResponseHandled}
        />
      </div>
    );
  }

  // ─── Button Variant (Modal) ─────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="relative"
        >
          <Clock className="w-4 h-4 mr-2" />
          Pending Responses
          {pendingCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 bg-orange-100 text-orange-800"
            >
              {pendingCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2 pb-4 border-b border-slate-200">
          <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Users className="w-6 h-6 text-orange-600" />
            Pending Community Responses
          </DialogTitle>
          <p className="text-sm text-slate-600">
            Review and approve community contributions to strengthen your arguments
          </p>
        </DialogHeader>

        <div className="py-4">
          <PendingResponsesList
            deliberationId={deliberationId}
            onResponseHandled={() => {
              onResponseHandled?.();
              // Optionally close modal after handling
              // setOpen(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
