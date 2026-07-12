"use client";

import * as React from "react";
import { CommitmentsPanel } from "@/packages/ludics-react/CommitmentsPanel";

/**
 * LudicsCommitmentsView — Displays commitment panels for both participants
 * 
 * Phase 2: Task 2.3
 * Extracted from LudicsPanel.tsx (lines ~1195-1205)
 */

interface LudicsCommitmentsViewProps {
  deliberationId: string;
  onChanged?: () => void;
}

export function LudicsCommitmentsView({
  deliberationId,
  onChanged = () => {},
}: LudicsCommitmentsViewProps) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <CommitmentsPanel
        dialogueId={deliberationId}
        ownerId="Proponent"
        onChanged={onChanged}
      />
      <CommitmentsPanel
        dialogueId={deliberationId}
        ownerId="Opponent"
        onChanged={onChanged}
      />
    </div>
  );
}
