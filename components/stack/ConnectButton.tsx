"use client";

/**
 * ConnectButton
 * 
 * Phase 1.3 of Stacks Improvement Roadmap
 * 
 * Reusable button component that opens the ConnectModal.
 * Supports icon, text, and full variants.
 */

import { useState } from "react";
import { Link2Icon } from "lucide-react";
import { ConnectModal } from "./modals/ConnectModal";
import { cn } from "@/lib/utils";

interface ConnectButtonProps {
  blockId: string;
  blockTitle: string;
  currentStackIds: string[];
  variant?: "icon" | "text" | "full";
  className?: string;
  onUpdate?: () => void;
}

export function ConnectButton({
  blockId,
  blockTitle,
  currentStackIds,
  variant = "text",
  className,
  onUpdate,
}: ConnectButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className={cn(
            "p-2 rounded-md hover:bg-muted transition-colors",
            className
          )}
          title="Connect to stacks"
        >
          <Link2Icon className="h-4 w-4" />
        </button>
        <ConnectModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          blockId={blockId}
          blockTitle={blockTitle}
          currentStackIds={currentStackIds}
          onUpdate={onUpdate}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={cn(
          "px-2 py-1 text-xs rounded-md border bg-white/90 hover:bg-muted",
          "flex items-center gap-1.5 transition-colors",
          className
        )}
      >
        <Link2Icon className="h-3.5 w-3.5" />
        {variant === "full" ? "Connect to Stack" : "Connect"}
      </button>
      <ConnectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        blockId={blockId}
        blockTitle={blockTitle}
        currentStackIds={currentStackIds}
        onUpdate={onUpdate}
      />
    </>
  );
}
