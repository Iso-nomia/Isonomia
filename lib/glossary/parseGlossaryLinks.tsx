// lib/glossary/parseGlossaryLinks.tsx
/**
 * Utilities for parsing and rendering glossary term links in text
 * 
 * Supports syntax: [[termId:Term Name]] or [[termId]]
 * Example: "This is about [[cm123:Justice]] and [[cm456:Freedom]]"
 */

import { GlossaryTermLink } from "@/components/glossary/GlossaryTermLink";
import React from "react";

export interface GlossaryLinkMatch {
  fullMatch: string;
  termId: string;
  termName?: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Parse text to find glossary term markers
 * Syntax: [[termId:Term Name]] or [[termId]]
 */
export function parseGlossaryLinks(text: string): GlossaryLinkMatch[] {
  const regex = /\[\[([^\]:]+)(?::([^\]]+))?\]\]/g;
  const matches: GlossaryLinkMatch[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      fullMatch: match[0],
      termId: match[1],
      termName: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return matches;
}

/**
 * Convert text with glossary markers to React elements with GlossaryTermLink components
 */
export function renderGlossaryLinks(text: string): React.ReactNode[] {
  const matches = parseGlossaryLinks(text);
  
  if (matches.length === 0) {
    return [text];
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, idx) => {
    // Add text before the match
    if (match.startIndex > lastIndex) {
      elements.push(text.slice(lastIndex, match.startIndex));
    }

    // Add the glossary link
    elements.push(
      <GlossaryTermLink
        key={`glossary-${match.termId}-${idx}`}
        termId={match.termId}
        termName={match.termName || match.termId}
      />
    );

    lastIndex = match.endIndex;
  });

  // Add remaining text after last match
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}

/**
 * Helper to create glossary link syntax
 */
export function createGlossaryLinkSyntax(termId: string, termName?: string): string {
  return termName ? `[[${termId}:${termName}]]` : `[[${termId}]]`;
}

/**
 * Remove glossary link syntax from text (useful for plain text export)
 */
export function stripGlossaryLinks(text: string): string {
  return text.replace(/\[\[([^\]:]+)(?::([^\]]+))?\]\]/g, (_, termId, termName) => {
    return termName || termId;
  });
}

/**
 * Check if text contains glossary links
 */
export function hasGlossaryLinks(text: string): boolean {
  return /\[\[([^\]:]+)(?::([^\]]+))?\]\]/.test(text);
}
