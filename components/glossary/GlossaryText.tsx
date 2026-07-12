// components/glossary/GlossaryText.tsx
"use client";

import { renderGlossaryLinks } from "@/lib/glossary/parseGlossaryLinks";
import { cn } from "@/lib/utils";

interface GlossaryTextProps {
  text: string;
  className?: string;
  as?: "p" | "span" | "div";
}

/**
 * Renders text with glossary term links
 * Use this component to display user content that may contain [[termId:Term Name]] markers
 */
export function GlossaryText({ text, className, as: Component = "span" }: GlossaryTextProps) {
  const elements = renderGlossaryLinks(text);

  return (
    <Component className={className}>
      {elements}
    </Component>
  );
}
