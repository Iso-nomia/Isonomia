// lib/argumentation/schemeInference.ts
/**
 * Database-Driven Scheme Inference (Phase 1 - October 31, 2025)
 * Phase 4: Multi-Scheme Support with CQ Merging
 * 
 * This module infers and assigns argumentation schemes to arguments based on:
 * 1. Database queries (all schemes in ArgumentScheme table)
 * 2. Taxonomy-based scoring (Macagno dimensions: materialRelation, reasoningType, source, purpose)
 * 3. Text pattern matching (regex heuristics for specific indicators)
 * 
 * Phase 4 Enhancement: Supports multi-scheme classification with confidence scores
 * and merged CQ sets using generateCompleteCQSet()
 * 
 * Supports all schemes defined in database (7+ schemes including practical_reasoning, causal, classification)
 * Previously only supported 4 hardcoded schemes via lib/argumentation/criticalQuestions.ts (now deprecated)
 * 
 * @see scripts/schemes.seed.ts for scheme definitions
 * @see lib/argumentation/criticalQuestions.ts (LEGACY - deprecated)
 * @see lib/argumentation/cqGeneration.ts (CQ generation and merging)
 */

import { prisma } from '@/lib/prismaclient';
import type { ArgumentScheme } from '@prisma/client';
import { generateCompleteCQSet, type CriticalQuestion, type TaxonomyFields } from './cqGeneration';

/**
 * Scheme with scoring metadata for inference
 */
type SchemeScoringResult = {
  scheme: Pick<ArgumentScheme, 'id' | 'key' | 'name' | 'materialRelation' | 'reasoningType' | 'source' | 'purpose'>;
  score: number;
  reasons: string[]; // Debug: why this scheme scored high
};

/**
 * Result from multi-scheme inference (Phase 4)
 */
export type InferredScheme = {
  schemeId: string;
  schemeKey: string;
  schemeName: string;
  confidence: number; // Normalized score (0.0-1.0)
  isPrimary: boolean; // Highest-scoring scheme
};

/**
 * Infers argumentation schemes from text using database-driven taxonomy scoring.
 * Returns ranked list of scheme keys that match the text.
 * 
 * LEGACY: Returns only scheme keys (for backward compatibility).
 * Use inferSchemesFromTextWithScores() for multi-scheme support (Phase 4+).
 * 
 * @param text - Argument text (and optionally conclusion text)
 * @returns Array of scheme keys, ordered by relevance score (highest first)
 */
export async function inferSchemesFromText(text: string): Promise<string[]> {
  // Fetch all schemes from database with taxonomy fields
  const schemes = await prisma.argumentScheme.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      materialRelation: true,
      reasoningType: true,
      source: true,
      purpose: true
    }
  });

  if (schemes.length === 0) {
    console.warn('[schemeInference] No schemes found in database. Run seed script: npx tsx scripts/schemes.seed.ts');
    return ['positive_consequences']; // Fallback to most general scheme
  }

  // Score each scheme based on text analysis + taxonomy
  const scoredSchemes: SchemeScoringResult[] = schemes.map(scheme => {
    const { score, reasons } = calculateSchemeScore(text, scheme);
    return { scheme, score, reasons };
  });

  // Sort by score descending
  scoredSchemes.sort((a, b) => b.score - a.score);

  // Filter schemes with meaningful scores (threshold: 0.2)
  const threshold = 0.2;
  const matches = scoredSchemes.filter(s => s.score >= threshold);

  if (matches.length === 0) {
    // No matches above threshold - return top scorer OR fallback
    const topScheme = scoredSchemes[0];
    console.log(`[schemeInference] No strong matches (threshold=${threshold}). Using top scorer: "${topScheme.scheme.key}" (score=${topScheme.score.toFixed(2)})`);
    return [topScheme.scheme.key];
  }

  // Log inference decision
  const topMatch = matches[0];
  console.log(`[schemeInference] Inferred "${topMatch.scheme.key}" (score=${topMatch.score.toFixed(2)}) for text: "${text.slice(0, 80)}..."`);
  if (topMatch.reasons.length > 0) {
    console.log(`[schemeInference] Reasons: ${topMatch.reasons.join(', ')}`);
  }

  return matches.map(s => s.scheme.key);
}

/**
 * Infers multiple argumentation schemes from text with confidence scores (Phase 4).
 * Returns all schemes above threshold, ordered by confidence (highest first).
 * 
 * @param text - Argument text (and optionally conclusion text)
 * @param options - Configuration options
 * @param options.threshold - Minimum score to include scheme (default: 0.3)
 * @param options.maxSchemes - Maximum number of schemes to return (default: 5)
 * @returns Array of inferred schemes with confidence scores
 */
export async function inferSchemesFromTextWithScores(
  text: string,
  options: { threshold?: number; maxSchemes?: number } = {}
): Promise<InferredScheme[]> {
  const { threshold = 0.3, maxSchemes = 5 } = options;

  // Fetch all schemes from database with taxonomy fields
  const schemes = await prisma.argumentScheme.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      materialRelation: true,
      reasoningType: true,
      source: true,
      purpose: true
    }
  });

  if (schemes.length === 0) {
    console.warn('[schemeInference] No schemes found in database. Run seed script: npx tsx scripts/schemes.seed.ts');
    return [];
  }

  // Score each scheme based on text analysis + taxonomy
  const scoredSchemes: SchemeScoringResult[] = schemes.map(scheme => {
    const { score, reasons } = calculateSchemeScore(text, scheme);
    return { scheme, score, reasons };
  });

  // Sort by score descending
  scoredSchemes.sort((a, b) => b.score - a.score);

  // Filter schemes above threshold and limit to maxSchemes
  const matches = scoredSchemes
    .filter(s => s.score >= threshold)
    .slice(0, maxSchemes);

  // If no matches above threshold, include top scorer
  if (matches.length === 0 && scoredSchemes.length > 0) {
    matches.push(scoredSchemes[0]);
    console.log(`[schemeInference] No strong matches (threshold=${threshold}). Including top scorer: "${scoredSchemes[0].scheme.key}" (score=${scoredSchemes[0].score.toFixed(2)})`);
  }

  // Normalize scores to 0-1 range for confidence
  const maxScore = matches[0]?.score || 1;
  const minScore = Math.min(...matches.map(m => m.score));
  const scoreRange = maxScore - minScore || 1;

  const results: InferredScheme[] = matches.map((match, index) => {
    // Normalize score to 0-1 range (relative to top scorer)
    const confidence = match.score / maxScore;
    
    return {
      schemeId: match.scheme.id,
      schemeKey: match.scheme.key,
      schemeName: match.scheme.name || match.scheme.key,
      confidence: Math.min(1.0, Math.max(0.0, confidence)),
      isPrimary: index === 0
    };
  });

  // Log multi-scheme inference
  if (results.length > 1) {
    console.log(`[schemeInference] Multi-scheme inference for text: "${text.slice(0, 80)}..."`);
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.schemeKey} (confidence: ${(r.confidence * 100).toFixed(0)}%)${r.isPrimary ? ' [PRIMARY]' : ''}`);
    });
  } else if (results.length === 1) {
    console.log(`[schemeInference] Single scheme: "${results[0].schemeKey}" (confidence: ${(results[0].confidence * 100).toFixed(0)}%)`);
  }

  return results;
}

/**
 * Taxonomy-based scoring function using Macagno dimensions.
 * Combines multiple signals: materialRelation, reasoningType, source, purpose, and text patterns.
 * 
 * Scoring weights:
 * - Material relation patterns: 0.5 (strongest signal)
 * - Reasoning type patterns: 0.4
 * - Source/authority indicators: 0.3
 * - Purpose/conclusion type: 0.2
 * 
 * @param text - Argument text (lowercased for pattern matching)
 * @param scheme - Scheme with taxonomy fields
 * @returns Object with score (0-1+) and debug reasons
 */
function calculateSchemeScore(
  text: string,
  scheme: Pick<ArgumentScheme, 'key' | 'materialRelation' | 'reasoningType' | 'source' | 'purpose'>
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const lower = text.toLowerCase();

  // === Material Relation Scoring (Primary Signal) ===
  
  if (scheme.materialRelation === 'authority') {
    // Expert opinion, credentials, studies, citations
    if (/(phd|m\.?d\.?|prof|professor|dr\.|doctor|expert|scholar|researcher)/i.test(text)) {
      score += 0.5;
      reasons.push('authority credentials (phd/prof/expert)');
    }
    if (/(study|research|paper|publication|journal|peer[-\s]review)/i.test(text)) {
      score += 0.3;
      reasons.push('research/study citation');
    }
    if (/(according to|cited|cites|states|claims|asserts|argues)/i.test(text)) {
      score += 0.2;
      reasons.push('attribution language');
    }
  }

  if (scheme.materialRelation === 'cause') {
    // Causal relationships, cause-effect language
    if (/(because|therefore|thus|hence|consequently|as a result|leads to|causes|results in)/i.test(text)) {
      score += 0.5;
      reasons.push('causal connectives (because/therefore/leads to)');
    }
    if (/(if .+ then|when .+ then|correlation|relationship|effect|impact)/i.test(text)) {
      score += 0.3;
      reasons.push('conditional/causal structure');
    }
    if (/(due to|owing to|stems from|originates from)/i.test(text)) {
      score += 0.2;
      reasons.push('causal attribution');
    }
  }

  if (scheme.materialRelation === 'analogy') {
    // Similarity, comparison, "like X"
    if (/\b(like|similar to|resembles|comparable to|akin to|analogous to)\b/i.test(text)) {
      score += 0.5;
      reasons.push('analogy markers (like/similar/comparable)');
    }
    if (/(as if|as though|in the same way|just as)/i.test(text)) {
      score += 0.3;
      reasons.push('comparison structure');
    }
  }

  if (scheme.materialRelation === 'definition') {
    // Classification, categorization, "is a", "belongs to"
    const hasDefSignal = /\b(is a|are a|belongs to|falls under|classified as|defined as|type of|kind of)\b/i.test(text);
    const hasCategorical = /(category|class|group|type|sort|taxonomy)/i.test(text);
    
    if (hasDefSignal) {
      score += 0.5;
      reasons.push('classification language (is a/belongs to)');
      
      // Boost classification when combined with "because" (explanatory classification)
      if (/\b(because|since|as)\b/i.test(text)) {
        score += 0.4;
        reasons.push('explanatory classification structure');
      }
    }
    if (hasCategorical) {
      score += 0.2;
      reasons.push('categorical terms');
    }
  }

  if (scheme.materialRelation === 'practical') {
    // Action, policy, means-end reasoning
    if (/(in order to|so that|for the purpose of|to achieve|goal|objective)/i.test(text)) {
      score += 0.4;
      reasons.push('practical means-end structure');
    }
    if (/(action|policy|strategy|approach|method|plan)/i.test(text)) {
      score += 0.2;
      reasons.push('action/policy terms');
    }
  }

  // === Reasoning Type Scoring (Secondary Signal) ===
  
  if (scheme.reasoningType === 'practical') {
    // Normative, ought, should, must
    if (/(should|ought|must|need to|have to|required|necessary)/i.test(text)) {
      score += 0.4;
      reasons.push('practical/normative language (should/ought/must)');
    }
    if (/(goal|aim|objective|purpose|end|target)/i.test(text)) {
      score += 0.2;
      reasons.push('goal-oriented language');
    }
  }

  if (scheme.reasoningType === 'abductive') {
    // Best explanation, inference to best explanation
    if (/(best explanation|explains|account for|reason why|makes sense)/i.test(text)) {
      score += 0.4;
      reasons.push('abductive reasoning (best explanation)');
    }
    if (/(likely|probably|suggests|indicates|evidence for)/i.test(text)) {
      score += 0.2;
      reasons.push('probabilistic/evidential language');
    }
  }

  if (scheme.reasoningType === 'inductive') {
    // Generalization, patterns, trends, statistics
    if (/(generally|usually|typically|often|frequently|trend|pattern)/i.test(text)) {
      score += 0.3;
      reasons.push('inductive generalization');
    }
    if (/(statistic|data|sample|survey|study shows|evidence suggests)/i.test(text)) {
      score += 0.3;
      reasons.push('empirical/statistical evidence');
    }
  }

  if (scheme.reasoningType === 'deductive') {
    // Logical necessity, "all", "every", "must"
    if (/(all .+ are|every .+ is|necessarily|logically|follows that)/i.test(text)) {
      score += 0.4;
      reasons.push('deductive structure (all/every/necessarily)');
    }
  }

  // === Source Scoring (Tertiary Signal) ===
  
  if (scheme.source === 'external') {
    // Citations, quotations, external authorities
    if (/(according to|cited|source|reference|quotes|states|claims)/i.test(text)) {
      score += 0.3;
      reasons.push('external source attribution');
    }
    if (/(author|researcher|scientist|economist|analyst|spokesman)/i.test(text)) {
      score += 0.2;
      reasons.push('external authority figure');
    }
  }

  if (scheme.source === 'internal') {
    // First-person reasoning, "we should", "I believe"
    if (/(we should|i believe|i think|in my view|our position|we ought)/i.test(text)) {
      score += 0.2;
      reasons.push('internal reasoning (we/I)');
    }
  }

  // === Purpose Scoring (Minor Signal) ===
  
  if (scheme.purpose === 'action') {
    // Action-oriented, policy, recommendation
    if (/(adopt|implement|enact|pursue|take action|do|perform)/i.test(text)) {
      score += 0.2;
      reasons.push('action-oriented language');
    }
  }

  if (scheme.purpose === 'state_of_affairs') {
    // Descriptive, "is", "are", factual claims
    if (/(is true|is false|fact|reality|actually|indeed)/i.test(text)) {
      score += 0.1;
      reasons.push('descriptive/factual language');
    }
  }

  // === Special Scheme-Specific Patterns ===
  
  // Consequences schemes - only boost if explicitly about outcomes/consequences
  if (scheme.key === 'positive_consequences' || scheme.key === 'negative_consequences') {
    // Require explicit consequence framing, not just causal language
    const hasExplicitConsequence = /(consequence|outcome|result of|outcome of|effect of|impact of|leads to .+ consequence)/i.test(text);
    const hasBenefitHarm = /(benefit|advantage|harm|damage|cost)/i.test(text);
    
    // Only apply consequence bonus if BOTH consequence framing AND valence present
    if (hasExplicitConsequence || hasBenefitHarm) {
      if (/(benefit|advantage|good|positive|improve|better|enhance)/i.test(text)) {
        const weight = scheme.key === 'positive_consequences' ? 0.3 : -0.1;
        score += weight;
        if (weight > 0) reasons.push('positive consequence indicators');
      }
      if (/(harm|damage|cost|negative|worse|problem|risk|danger)/i.test(text)) {
        const weight = scheme.key === 'negative_consequences' ? 0.3 : -0.1;
        score += weight;
        if (weight > 0) reasons.push('negative consequence indicators');
      }
      if (hasExplicitConsequence) {
        score += 0.1; // Reduced from 0.2
        reasons.push('consequence language');
      }
    }
    
    // Penalize consequences when strong classification signal present
    if (/\b(is a|are a|belongs to|classified as|defined as|type of|kind of)\b/i.test(text)) {
      score -= 0.4; // Increased penalty
      reasons.push('penalty: classification context');
    }
    
    // Penalize consequences when causal is more appropriate (pure if-then without valence)
    if (/(if .+ then|when .+ then)/i.test(text) && !hasBenefitHarm) {
      score -= 0.3;
      reasons.push('penalty: pure causal structure');
    }
  }

  // Causal scheme - penalize when in pure classification context
  if (scheme.key === 'causal') {
    if (/(cause|lead to|result in|produce|bring about)/i.test(text)) {
      score += 0.3;
      reasons.push('causal language');
    }
    
    // Strong penalty when "is a/are a" is the main structure (classification, not causal)
    if (/\b(is a|are a)\b.+(because|since|as)/i.test(text)) {
      score -= 0.5; // Strong penalty for "X is a Y because Z" pattern
      reasons.push('penalty: classification pattern with causal connective');
    }
  }

  // Sign/Indicator schemes
  if (scheme.materialRelation === 'correlation' || lower.includes('sign') || lower.includes('indicator')) {
    if (/(sign|indicator|symptom|signal|marker|proxy|suggests)/i.test(text)) {
      score += 0.4;
      reasons.push('sign/indicator language');
    }
  }

  return { score: Math.max(0, score), reasons };
}

/**
 * Infers and assigns an argumentation scheme to an argument based on text analysis.
 * Uses database-driven inference with taxonomy-based scoring.
 * Falls back to 'positive_consequences' if no schemes found or matched.
 *
 * LEGACY: Assigns single scheme only (backward compatibility).
 * Use inferAndAssignMultipleSchemes() for Phase 4+ multi-scheme support.
 *
 * @param argumentText - The text of the argument
 * @param conclusionText - Optional text of the conclusion claim
 * @returns Scheme ID (database ID) or null if no scheme found
 */
export async function inferAndAssignScheme(
  argumentText: string,
  conclusionText?: string
): Promise<string | null> {
  const combined = [argumentText, conclusionText].filter(Boolean).join(' ');

  // Use new database-driven inference
  let schemeKeys = await inferSchemesFromText(combined);

  // Default fallback if no scheme detected
  if (schemeKeys.length === 0) {
    console.warn('[schemeInference] No schemes matched. Falling back to positive_consequences');
    schemeKeys = ['positive_consequences']; // Most general scheme
  }

  // Lookup scheme row by key (converts scheme key → DB ID)
  const schemeRow = await prisma.argumentScheme.findFirst({
    where: { key: schemeKeys[0] },
    select: { id: true, key: true, name: true }
  });

  if (schemeRow) {
    console.log(`[schemeInference] ✓ Assigned scheme "${schemeRow.key}" (${schemeRow.name}) to argument: "${argumentText.slice(0, 50)}..."`);
  } else {
    console.warn(`[schemeInference] ✗ No matching scheme found for key "${schemeKeys[0]}", falling back to null`);
  }

  return schemeRow?.id ?? null;
}

/**
 * Infers and assigns multiple argumentation schemes to an argument (Phase 4).
 * Creates ArgumentSchemeInstance records for all applicable schemes above threshold.
 * Merges CQs from all schemes using generateCompleteCQSet().
 * 
 * @param argumentId - Database ID of the argument
 * @param argumentText - The text of the argument
 * @param conclusionText - Optional text of the conclusion claim
 * @param options - Configuration options (threshold, maxSchemes)
 * @returns Array of created ArgumentSchemeInstance records
 */
export async function inferAndAssignMultipleSchemes(
  argumentId: string,
  argumentText: string,
  conclusionText?: string,
  options: { threshold?: number; maxSchemes?: number } = {}
): Promise<InferredScheme[]> {
  const combined = [argumentText, conclusionText].filter(Boolean).join(' ');

  // Infer schemes with confidence scores
  const inferredSchemes = await inferSchemesFromTextWithScores(combined, options);

  if (inferredSchemes.length === 0) {
    console.warn(`[schemeInference] No schemes inferred for argument ${argumentId}`);
    return [];
  }

  // Create ArgumentSchemeInstance records for each inferred scheme
  const instances = await Promise.all(
    inferredSchemes.map(async (inferred) => {
      // Check if instance already exists (idempotent)
      const existing = await prisma.argumentSchemeInstance.findUnique({
        where: {
          argumentId_schemeId: {
            argumentId,
            schemeId: inferred.schemeId
          }
        }
      });

      if (existing) {
        console.log(`[schemeInference] Scheme instance already exists: ${inferred.schemeKey} for argument ${argumentId}`);
        return inferred;
      }

      // Create new instance
      await prisma.argumentSchemeInstance.create({
        data: {
          argumentId,
          schemeId: inferred.schemeId,
          confidence: inferred.confidence,
          isPrimary: inferred.isPrimary
        }
      });

      console.log(`[schemeInference] ✓ Assigned scheme "${inferred.schemeKey}" (confidence: ${(inferred.confidence * 100).toFixed(0)}%)${inferred.isPrimary ? ' [PRIMARY]' : ''} to argument ${argumentId}`);
      
      return inferred;
    })
  );

  return instances;
}

/**
 * Merges CQs from multiple schemes for multi-scheme arguments (Phase 4).
 * Uses generateCompleteCQSet() to combine and deduplicate CQs.
 * 
 * @param argumentId - Database ID of the argument
 * @returns Merged array of critical questions from all assigned schemes
 */
export async function getMergedCQsForArgument(argumentId: string): Promise<CriticalQuestion[]> {
  // Fetch all scheme instances for this argument
  const instances = await prisma.argumentSchemeInstance.findMany({
    where: { argumentId },
    include: {
      scheme: {
        select: {
          key: true,
          cqs: true,
          purpose: true,
          source: true,
          materialRelation: true,
          reasoningType: true,
          ruleForm: true,
          conclusionType: true
        }
      }
    },
    orderBy: [
      { isPrimary: 'desc' },
      { confidence: 'desc' }
    ]
  });

  if (instances.length === 0) {
    return [];
  }

  // Merge CQs from all schemes
  const allCQs: CriticalQuestion[] = [];
  const seenKeys = new Set<string>();

  for (const instance of instances) {
    const scheme = instance.scheme;
    
    // Parse CQs from scheme (stored as JSON)
    const schemeCQs = Array.isArray(scheme.cqs) 
      ? (scheme.cqs as any[]).map(cq => ({
          cqKey: cq.cqKey || `${scheme.key}_${Math.random().toString(36).substring(7)}`,
          text: cq.text,
          attackType: cq.attackType as "REBUTS" | "UNDERCUTS" | "UNDERMINES",
          targetScope: cq.targetScope as "conclusion" | "inference" | "premise"
        }))
      : [];

    // Add CQs that haven't been seen yet (deduplicate by cqKey)
    for (const cq of schemeCQs) {
      if (!seenKeys.has(cq.cqKey)) {
        allCQs.push(cq);
        seenKeys.add(cq.cqKey);
      }
    }
  }

  // Use generateCompleteCQSet to prioritize and limit
  const primaryScheme = instances[0].scheme;
  const taxonomy: TaxonomyFields = {
    purpose: primaryScheme.purpose,
    source: primaryScheme.source,
    materialRelation: primaryScheme.materialRelation,
    reasoningType: primaryScheme.reasoningType,
    ruleForm: primaryScheme.ruleForm,
    conclusionType: primaryScheme.conclusionType
  };

  // Generate complete set with prioritization
  return generateCompleteCQSet(taxonomy, primaryScheme.key, allCQs, 15);
}

/**
 * Batch infer schemes for multiple arguments.
 * Useful for backfilling existing arguments.
 *
 * @param args - Array of { id, text, conclusionText? }
 * @returns Map of argumentId → schemeId
 */
export async function batchInferSchemes(
  args: Array<{ id: string; text: string; conclusionText?: string }>
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  for (const arg of args) {
    const schemeId = await inferAndAssignScheme(arg.text, arg.conclusionText);
    results.set(arg.id, schemeId);
  }

  return results;
}

// ============================================================================
// Phase 6C: Cluster-Aware Inference
// ============================================================================

/**
 * Phase 6C: Infer schemes with cluster awareness
 * 
 * Enhances standard inference by:
 * 1. Including parent schemes when child matches (e.g., if SSA matches, also include Negative Consequences)
 * 2. Including child schemes when parent matches strongly (e.g., if Practical Reasoning matches, check specific subtypes)
 * 3. Boosting confidence for schemes in the same cluster
 * 
 * Based on Macagno & Walton Section 6: Scheme Clustering & Family Resemblances
 * 
 * @param text - Argument text
 * @param options - Configuration
 * @param options.includeParents - Include parent schemes of matches (default: true)
 * @param options.includeChildren - Include child schemes of matches (default: true)
 * @param options.threshold - Minimum score threshold (default: 0.3)
 * @param options.maxSchemes - Maximum schemes to return (default: 8)
 * @param options.parentBoost - Confidence boost for parent schemes (default: 0.8)
 * @param options.childBoost - Confidence boost for child schemes (default: 0.9)
 * @returns Array of inferred schemes with family relationships
 */
export async function inferSchemesWithClusters(
  text: string,
  options: {
    includeParents?: boolean;
    includeChildren?: boolean;
    threshold?: number;
    maxSchemes?: number;
    parentBoost?: number;
    childBoost?: number;
  } = {}
): Promise<Array<InferredScheme & { source: 'direct' | 'parent' | 'child'; familyDepth?: number }>> {
  const {
    includeParents = true,
    includeChildren = true,
    threshold = 0.3,
    maxSchemes = 8,
    parentBoost = 0.8,
    childBoost = 0.9,
  } = options;

  // Step 1: Run standard inference
  const directMatches = await inferSchemesFromTextWithScores(text, {
    threshold,
    maxSchemes: maxSchemes * 2, // Get more candidates for cluster expansion
  });

  // Fetch schemes with hierarchy information
  const allSchemeIds = directMatches.map((m) => m.schemeId);
  const schemesWithHierarchy = await prisma.argumentScheme.findMany({
    where: { id: { in: allSchemeIds } },
    select: {
      id: true,
      key: true,
      name: true,
      parentSchemeId: true,
      clusterTag: true,
      parentScheme: {
        select: {
          id: true,
          key: true,
          name: true,
          clusterTag: true,
          parentScheme: {
            select: {
              id: true,
              key: true,
              name: true,
              clusterTag: true,
            },
          },
        },
      },
      childSchemes: {
        select: {
          id: true,
          key: true,
          name: true,
          clusterTag: true,
          materialRelation: true,
          reasoningType: true,
          source: true,
          purpose: true,
        },
      },
    },
  });

  // Build result set with family relationships
  const results: Array<InferredScheme & { source: 'direct' | 'parent' | 'child'; familyDepth?: number }> = [];
  const seenIds = new Set<string>();

  // Add direct matches
  for (const match of directMatches) {
    results.push({
      ...match,
      source: 'direct',
      familyDepth: 0,
    });
    seenIds.add(match.schemeId);
  }

  // Step 2: Include parent schemes (if enabled)
  if (includeParents) {
    for (const match of directMatches) {
      const schemeInfo = schemesWithHierarchy.find((s) => s.id === match.schemeId);
      if (!schemeInfo) continue;

      // Add immediate parent
      if (schemeInfo.parentScheme && !seenIds.has(schemeInfo.parentScheme.id)) {
        results.push({
          schemeId: schemeInfo.parentScheme.id,
          schemeKey: schemeInfo.parentScheme.key,
          schemeName: schemeInfo.parentScheme.name || schemeInfo.parentScheme.key,
          confidence: match.confidence * parentBoost, // Parent gets 80% of child's confidence
          isPrimary: false,
          source: 'parent',
          familyDepth: 1,
        });
        seenIds.add(schemeInfo.parentScheme.id);

        // Add grandparent (if exists)
        if (schemeInfo.parentScheme.parentScheme && !seenIds.has(schemeInfo.parentScheme.parentScheme.id)) {
          results.push({
            schemeId: schemeInfo.parentScheme.parentScheme.id,
            schemeKey: schemeInfo.parentScheme.parentScheme.key,
            schemeName: schemeInfo.parentScheme.parentScheme.name || schemeInfo.parentScheme.parentScheme.key,
            confidence: match.confidence * parentBoost * 0.9, // Grandparent gets 72% (0.8 * 0.9)
            isPrimary: false,
            source: 'parent',
            familyDepth: 2,
          });
          seenIds.add(schemeInfo.parentScheme.parentScheme.id);
        }
      }
    }
  }

  // Step 3: Include child schemes (if enabled and parent matched strongly)
  if (includeChildren) {
    for (const match of directMatches) {
      // Only check children if parent matched with high confidence (>= 0.6)
      if (match.confidence < 0.6) continue;

      const schemeInfo = schemesWithHierarchy.find((s) => s.id === match.schemeId);
      if (!schemeInfo || schemeInfo.childSchemes.length === 0) continue;

      // Check each child scheme against the text
      for (const child of schemeInfo.childSchemes) {
        if (seenIds.has(child.id)) continue;

        // Score the child scheme
        const childScore = calculateSchemeScore(text, child);
        
        // If child scores reasonably (>= 0.4), include it with boosted confidence
        if (childScore.score >= 0.4) {
          results.push({
            schemeId: child.id,
            schemeKey: child.key,
            schemeName: child.name || child.key,
            confidence: Math.min(1.0, childScore.score * childBoost), // Child gets 90% boost
            isPrimary: false,
            source: 'child',
            familyDepth: 1,
          });
          seenIds.add(child.id);
        }
      }
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  // Limit to maxSchemes
  const limited = results.slice(0, maxSchemes);

  // Log cluster-aware inference
  const directCount = limited.filter((r) => r.source === 'direct').length;
  const parentCount = limited.filter((r) => r.source === 'parent').length;
  const childCount = limited.filter((r) => r.source === 'child').length;

  console.log(`[clusterInference] Text: "${text.slice(0, 60)}..."`);
  console.log(`[clusterInference] Found ${limited.length} schemes (${directCount} direct, ${parentCount} parent, ${childCount} child)`);
  
  limited.forEach((r, i) => {
    const marker = r.source === 'direct' ? '●' : r.source === 'parent' ? '↑' : '↓';
    const depth = r.familyDepth !== undefined ? ` (depth: ${r.familyDepth})` : '';
    console.log(`  ${i + 1}. ${marker} ${r.schemeName} (${(r.confidence * 100).toFixed(0)}%)${depth}`);
  });

  return limited;
}

/**
 * Phase 6C: Get scheme cluster information
 * 
 * Returns the full family tree for a scheme (ancestors and descendants).
 * Useful for UI display and understanding scheme relationships.
 * 
 * @param schemeId - ID of the scheme to get cluster info for
 * @returns Cluster information with ancestors and descendants
 */
export async function getSchemeCluster(schemeId: string): Promise<{
  scheme: { id: string; key: string; name: string; clusterTag: string | null };
  ancestors: Array<{ id: string; key: string; name: string; depth: number }>;
  descendants: Array<{ id: string; key: string; name: string; depth: number }>;
  clusterMembers: Array<{ id: string; key: string; name: string }>;
}> {
  const scheme = await prisma.argumentScheme.findUnique({
    where: { id: schemeId },
    select: {
      id: true,
      key: true,
      name: true,
      clusterTag: true,
      parentSchemeId: true,
      parentScheme: {
        select: {
          id: true,
          key: true,
          name: true,
          parentScheme: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
      },
      childSchemes: {
        select: {
          id: true,
          key: true,
          name: true,
          childSchemes: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!scheme) {
    throw new Error(`Scheme ${schemeId} not found`);
  }

  // Collect ancestors (parents, grandparents)
  const ancestors: Array<{ id: string; key: string; name: string; depth: number }> = [];
  if (scheme.parentScheme) {
    ancestors.push({
      id: scheme.parentScheme.id,
      key: scheme.parentScheme.key,
      name: scheme.parentScheme.name || scheme.parentScheme.key,
      depth: 1,
    });
    if (scheme.parentScheme.parentScheme) {
      ancestors.push({
        id: scheme.parentScheme.parentScheme.id,
        key: scheme.parentScheme.parentScheme.key,
        name: scheme.parentScheme.parentScheme.name || scheme.parentScheme.parentScheme.key,
        depth: 2,
      });
    }
  }

  // Collect descendants (children, grandchildren)
  const descendants: Array<{ id: string; key: string; name: string; depth: number }> = [];
  for (const child of scheme.childSchemes) {
    descendants.push({
      id: child.id,
      key: child.key,
      name: child.name || child.key,
      depth: 1,
    });
    for (const grandchild of child.childSchemes) {
      descendants.push({
        id: grandchild.id,
        key: grandchild.key,
        name: grandchild.name || grandchild.key,
        depth: 2,
      });
    }
  }

  // Get all schemes in same cluster
  const clusterMembers = scheme.clusterTag
    ? await prisma.argumentScheme.findMany({
        where: { clusterTag: scheme.clusterTag },
        select: { id: true, key: true, name: true },
      })
    : [];

  return {
    scheme: {
      id: scheme.id,
      key: scheme.key,
      name: scheme.name || scheme.key,
      clusterTag: scheme.clusterTag,
    },
    ancestors,
    descendants,
    clusterMembers: clusterMembers.map((m) => ({
      id: m.id,
      key: m.key,
      name: m.name || m.key,
    })),
  };
}