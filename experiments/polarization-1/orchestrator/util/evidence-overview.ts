/**
 * orchestrator/util/evidence-overview.ts
 *
 * Renders a brief structured prose summary of the bound evidence corpus for
 * the Claim Analyst's `EVIDENCE_CORPUS_OVERVIEW` slot. Pulled from
 * `GET /api/deliberations/[id]/evidence-context`.
 *
 * Critically, this overview must NOT cite individual sources by token
 * (`src:*`) — the prompt forbids the Claim Analyst from citing in Phase 1.
 * We render category counts and a tag-frequency histogram only.
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
}

export function renderEvidenceOverview(opts: {
  stack: { id: string; name: string; sourceCount: number };
  sources: EvidenceSource[];
}): string {
  const { stack, sources } = opts;

  // Tag histogram (top 12).
  const tagCounts = new Map<string, number>();
  for (const s of sources) {
    for (const t of s.tags) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  // Year span.
  const years = sources
    .map((s) => (s.publishedAt ? Number(s.publishedAt.slice(0, 4)) : null))
    .filter((y): y is number => Number.isFinite(y as number));
  const yearMin = years.length ? Math.min(...years) : null;
  const yearMax = years.length ? Math.max(...years) : null;

  // Coverage signals (heuristic: tag substrings).
  const has = (substr: string) =>
    sources.some((s) =>
      s.tags.some((t) => t.toLowerCase().includes(substr)) ||
      (s.title ?? "").toLowerCase().includes(substr) ||
      (s.abstract ?? "").toLowerCase().includes(substr),
    );
  const coverage = {
    experimental: has("experiment") || has("rct") || has("randomi"),
    observational: has("observational") || has("regression") || has("difference-in-differences") || has("instrumental"),
    metaAnalysis: has("meta-analysis") || has("systematic review"),
    skeptical: has("null") || has("minimal effects") || has("skeptic"),
    crossNational: has("cross-national") || has("cross-country"),
  };

  const lines: string[] = [];
  lines.push(`Stack "${stack.name}" (id: ${stack.id}) — ${stack.sourceCount} bound sources.`);
  if (yearMin !== null && yearMax !== null) {
    lines.push(`Publication year span: ${yearMin}–${yearMax}.`);
  }
  lines.push("");
  lines.push("Coverage signals (heuristic):");
  for (const [k, v] of Object.entries(coverage)) {
    lines.push(`  - ${k}: ${v ? "present" : "absent or under-represented"}`);
  }
  if (topTags.length) {
    lines.push("");
    lines.push("Top tags by source count:");
    for (const [t, c] of topTags) lines.push(`  - ${t} (${c})`);
  }
  return lines.join("\n");
}
