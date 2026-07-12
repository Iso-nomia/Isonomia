import type { AudienceSelector, MessageFacet } from "@app/sheaf-acl";
import { audienceSubsetOf } from "@app/sheaf-acl";
import type { AudienceEnv } from "@app/sheaf-acl";
import { DIVERGENCE_WARNING_THRESHOLD } from "@/lib/config/confidence";

function extractText(body: any): string {
  if (!body) return '';
  if (typeof body === 'string') return body;
  if (typeof body.text === 'string') return body.text;
  // TipTap JSON: concatenate text nodes
  try {
    const parts: string[] = [];
    const walk = (node: any) => {
      if (!node) return;
      if (typeof node.text === 'string') parts.push(node.text);
      if (Array.isArray(node.content)) node.content.forEach(walk);
    };
    walk(body);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  } catch { return ''; }
}

function jaccard(a: Set<string>, b: Set<string>) {
  const inter = new Set([...a].filter(x => b.has(x))).size;
  const uni = new Set([...a, ...b]).size || 1;
  return inter / uni;
}

function tokenize(s: string) {
  return new Set(s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter(Boolean));
}

function likelyOverlap(a: AudienceSelector, b: AudienceSelector, env?: AudienceEnv): 'yes'|'no'|'maybe' {
  const triAB = audienceSubsetOf(a, b, env);
  const triBA = audienceSubsetOf(b, a, env);
  if (triAB === 'yes' || triBA === 'yes') return 'yes';       // subset either way -> overlap
  if (triAB === 'no' && triBA === 'no') return 'maybe';        // could still partially overlap
  // quick known-disjoint checks
  if (a.kind === 'USERS' && b.kind === 'USERS' && a.mode === 'SNAPSHOT' && b.mode === 'SNAPSHOT') {
    const A = new Set((a.snapshotMemberIds ?? a.userIds ?? []).map(String));
    const B = new Set((b.snapshotMemberIds ?? b.userIds ?? []).map(String));
    const inter = [...A].some(x => B.has(x));
    return inter ? 'yes' : 'no';
  }
  return 'maybe';
}

export type Conflict = {
  aFacetId: string;
  bFacetId: string;
  overlap: 'yes'|'no'|'maybe';
  textSim: number;          // 0..1 (Jaccard over tokens)
  severity: 'INFO'|'WARN'|'HIGH';
  note: string;
};

export function detectFacetConflicts(
  facets: MessageFacet[],
  env?: AudienceEnv,
  opts?: { highDivergenceBelowSim?: number; warnDivergenceBelowSim?: number }
): Conflict[] {
  const HIGH = opts?.highDivergenceBelowSim ?? 0.35; // lower sim -> more divergent
  const WARN = opts?.warnDivergenceBelowSim ?? DIVERGENCE_WARNING_THRESHOLD;

  const texts = new Map(facets.map(f => [f.id, tokenize(extractText(f.body))]));
  const out: Conflict[] = [];

  for (let i = 0; i < facets.length; i++) {
    for (let j = i + 1; j < facets.length; j++) {
      const a = facets[i], b = facets[j];
      const overlap = likelyOverlap(a.audience, b.audience, env);
      if (overlap === 'no') continue;

      const sim = jaccard(texts.get(a.id)!, texts.get(b.id)!); // 0..1
      const severity =
        overlap === 'yes' && sim <= HIGH ? 'HIGH'
        : sim <= WARN ? 'WARN'
        : 'INFO';

      if (severity !== 'INFO') {
        out.push({
          aFacetId: a.id,
          bFacetId: b.id,
          overlap,
          textSim: sim,
          severity,
          note:
            severity === 'HIGH'
              ? 'Facets likely address overlapping audiences but diverge significantly.'
              : 'Facets may overlap with noticeable differences.',
        });
      }
    }
  }
  return out;
}
