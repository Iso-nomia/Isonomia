// lib/epistemic/inferEpistemicMetadata.ts
import { analyzeText, type Analysis } from '@/components/rhetoric/detectors';
import { classifySource } from '@/lib/rhetoric/sourceQuality';

export type EpistemicMetadata = {
  confidence: number;
  quantifier: 'SOME' | 'MANY' | 'MOST' | 'ALL' | null;
  modality: 'COULD' | 'LIKELY' | 'NECESSARY' | null;
  detectionMethod: 'nlp' | 'sources' | 'hybrid' | 'manual';
  signals: {
    hedges: number;
    boosters: number;
    absolutes: number;
    evidenceCount: number;
    sourceQuality: number; // 0-1
  };
};

export async function inferEpistemicMetadata(text: string, sources: string[] = []): Promise<EpistemicMetadata> {
  const analysis: Analysis = analyzeText(text);
  const words = Math.max(1, analysis.words);

  const hedges = analysis.counts['hedge'] ?? 0;
  const boosters = analysis.counts['booster'] ?? 0;
  const absolutes = analysis.counts['absolute'] ?? 0;
  const evidenceCount = (analysis.counts['evidence'] ?? 0) + sources.length;

  let sourceQuality = 0.5;
  if (sources.length) {
    const grades = sources.map((u) => classifySource(u, text).score);
    sourceQuality = grades.reduce((a, b) => a + b, 0) / grades.length;
  }

  // Base
  let confidence = 0.7;

  // Sources (±0.15 window)
  confidence += (sourceQuality - 0.5) * 0.3;

  // Evidence density, cap +0.1
  const evidenceDensity = evidenceCount / Math.max(1, words / 100);
  confidence += Math.min(0.1, evidenceDensity * 0.05);

  // Hedges vs boosters
  const hedgeDensity = (hedges / words) * 100;
  const boosterDensity = (boosters / words) * 100;
  if (hedgeDensity > boosterDensity * 2) confidence -= 0.15;
  else if (boosterDensity > hedgeDensity * 2) confidence += 0.1;

  confidence = Math.max(0.1, Math.min(0.95, confidence));

  const quantifier = inferQuantifier(text);
  const modality = inferModality({ absolutes, boosters, analysis });

  return {
    confidence,
    quantifier,
    modality,
    detectionMethod: sources.length ? 'hybrid' : 'nlp',
    signals: { hedges, boosters, absolutes, evidenceCount, sourceQuality },
  };
}

// Minimal keyword sniffers (upgradeable)
function inferQuantifier(text: string) {
  if (/\b(all|every|always|universally)\b/i.test(text)) return 'ALL';
  if (/\b(most|generally|usually|typically)\b/i.test(text)) return 'MOST';
  if (/\b(many|often|frequently|commonly)\b/i.test(text)) return 'MANY';
  if (/\b(some|sometimes|occasionally|certain)\b/i.test(text)) return 'SOME';
  return null;
}
function inferModality({ absolutes, boosters, analysis }: { absolutes: number; boosters: number; analysis: Analysis }) {
  if (absolutes > 0) return 'NECESSARY';
  if (boosters > 0) return 'LIKELY';
  const hasDeductive = (analysis.counts['inference-deductive'] ?? 0) > 0;
  const hasInductive = (analysis.counts['inference-inductive'] ?? 0) > 0;
  if (hasDeductive) return 'NECESSARY';
  if (hasInductive) return 'LIKELY';
  return 'COULD';
}
