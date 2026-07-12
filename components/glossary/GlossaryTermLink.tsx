// components/glossary/GlossaryTermLink.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GlossaryTermModal } from "./GlossaryTermModal";

interface GlossaryTermLinkProps {
  termId: string;
  termName: string;
  children?: React.ReactNode;
  className?: string;
  /** If true, uses inline styles suitable for running text */
  inline?: boolean;
}

export function GlossaryTermLink({ 
  termId, 
  termName, 
  children, 
  className,
  inline = true 
}: GlossaryTermLinkProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsModalOpen(true);
        }}
        className={cn(
          "text-sky-800 underline decoration-sky-800 decoration underline-offset-4",
          "hover:text-sky-700 hover:decoration-sky-700 hover:decoration-[1.5px]",
          "transition-all duration-200 cursor-pointer",
          inline ? "inline" : "inline-block",
          "font-medium",
          className
        )}
        type="button"
      >
        {children || termName}
      </button>
      <GlossaryTermModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        termId={termId}
        termName={termName}
      />
    </>
  );
}
