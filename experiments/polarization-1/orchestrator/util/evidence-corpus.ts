/**
 * orchestrator/util/evidence-corpus.ts
 *
 * Renders the bound evidence corpus as a per-source listing for the
 * Advocate prompts (Phase 2/3). Unlike the Phase-1 evidence-overview,
 * this DOES emit each source's `citationToken` (`src:<id>`) — that's the
 * whole point: advocates need to know which tokens are valid.
 *
 * Each source block includes the metadata an advocate needs to assess
 * fit: title, authors, year, methodology hint, abstract, key findings,
 * tags. Bibliographic completeness is the reviewer's responsibility (the
 * `evidence-fidelity` LLM-judge in `review/phase-2-checks.ts` re-reads
 * the abstract when grading premise→source fidelity).
 */

interface EvidenceSource {
  sourceId: string;
  url: string | null;
  doi: string | null;
  title: string | null;
  authors: string[];
  publishedAt: string | null;
  abstract: string | null;
  keyFindings: string[];
  tags: string[];
  citationToken: string;
}

export function renderEvidenceCorpus(opts: {
  stack: { id: string; name: string; sourceCount: number };
  sources: EvidenceSource[];
}): string {
  const { stack, sources } = opts;
  const lines: string[] = [];
  lines.push(`Stack "${stack.name}" — ${stack.sourceCount} bound sources.`);
  lines.push(
    `Each entry begins with its citationToken (e.g. \`src:<id>\` or \`block:<id>\`, depending on the bound stack). Copy the token at the top of the entry verbatim. You may cite ONLY tokens listed below.`,
  );
  lines.push("");

  // Sort by sourceId for stability across runs.
  const sorted = [...sources].sort((a, b) => a.citationToken.localeCompare(b.citationToken));

  for (const s of sorted) {
    const yr = s.publishedAt ? s.publishedAt.slice(0, 4) : "n.d.";
    const authorStr = s.authors.length
      ? s.authors.length > 3
        ? `${s.authors[0]} et al.`
        : s.authors.join(", ")
      : "Anonymous";
    const tagStr = s.tags.length ? ` [${s.tags.join(", ")}]` : "";

    lines.push(`${s.citationToken}${tagStr}`);
    lines.push(`  ${authorStr} (${yr}). ${s.title ?? "(untitled)"}`);
    if (s.doi) lines.push(`  doi: ${s.doi}`);
    else if (s.url) lines.push(`  url: ${s.url}`);

    if (s.abstract) {
      // Trim and collapse whitespace; keep full abstract (advocates need it
      // for premise grounding).
      lines.push(`  abstract: ${s.abstract.trim().replace(/\s+/g, " ")}`);
    }
    if (s.keyFindings.length) {
      lines.push(`  key findings:`);
      for (const f of s.keyFindings) lines.push(`    - ${f.trim().replace(/\s+/g, " ")}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
