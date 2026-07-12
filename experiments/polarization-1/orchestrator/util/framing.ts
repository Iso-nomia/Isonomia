/**
 * orchestrator/util/framing.ts
 *
 * Extracts the `## Central contested claim` block from FRAMING.md. Used by
 * Phase 1 to feed the Claim Analyst the exact central-claim text without
 * the orchestrator hard-coding the claim string.
 */

import { readFileSync } from "fs";
import path from "path";

/** Returns the verbatim central claim sentence from `FRAMING.md`. */
export function loadFraming(experimentRoot: string): { full: string; centralClaim: string } {
  const p = path.join(experimentRoot, "FRAMING.md");
  const full = readFileSync(p, "utf8");
  const central = extractCentralClaim(full);
  return { full, centralClaim: central };
}

/**
 * Looks for the first `> **…**` blockquote-bold sentence under the
 * `## Central contested claim` heading. Throws if the section is missing or
 * the format doesn't match — author is expected to keep FRAMING.md
 * conformant with the template.
 */
export function extractCentralClaim(framing: string): string {
  const sectionMatch = framing.match(/^##\s+Central contested claim\s*\n+([\s\S]*?)(?=\n##\s|(?![\s\S]))/im);
  if (!sectionMatch) {
    throw new Error(
      `FRAMING.md: missing "## Central contested claim" section. ` +
        `Add the section with a blockquoted **bolded** claim sentence.`,
    );
  }
  const block = sectionMatch[1];
  // Match: "> **claim text**" possibly across lines
  const claimMatch = block.match(/>\s*\*\*([\s\S]*?)\*\*/);
  if (!claimMatch) {
    throw new Error(
      `FRAMING.md: "## Central contested claim" section present but no `+
        `\`> **central claim text**\` blockquote was found.`,
    );
  }
  return claimMatch[1].trim().replace(/\s+/g, " ");
}
