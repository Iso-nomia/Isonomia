// lib/utils/scheme-suggestion.ts
/**
 * Phase 0.5: Scheme Suggestion Helper
 * 
 * Helps users identify applicable argumentation schemes based on:
 * - Pattern matching against identification conditions
 * - Natural language similarity to "whenToUse" guidance
 * - Context keywords and tags
 */

export type SchemeMatch = {
  schemeId: string;
  schemeKey: string;
  schemeName: string;
  score: number;
  matchedConditions: string[];
  whenToUse: string;
  difficulty: string;
  tags: string[];
};

/**
 * Suggests schemes based on user's argument description
 */
export function suggestSchemes(
  userInput: string,
  allSchemes: Array<{
    id: string;
    key: string;
    name: string;
    identificationConditions: string[];
    whenToUse: string;
    tags: string[];
    difficulty: string;
  }>,
  options?: {
    maxResults?: number;
    minScore?: number;
    preferDifficulty?: "beginner" | "intermediate" | "advanced";
  }
): SchemeMatch[] {
  const { maxResults = 5, minScore = 0.2, preferDifficulty } = options || {};
  
  const normalizedInput = userInput.toLowerCase();
  const inputTokens = tokenize(normalizedInput);
  
  const matches: SchemeMatch[] = [];
  
  for (const scheme of allSchemes) {
    let score = 0;
    const matchedConditions: string[] = [];
    
    // 1. Pattern matching against identification conditions
    for (const condition of scheme.identificationConditions) {
      const normalizedCondition = condition.toLowerCase();
      const conditionTokens = tokenize(normalizedCondition);
      
      // Exact phrase match (highest weight)
      if (normalizedInput.includes(normalizedCondition)) {
        score += 1.0;
        matchedConditions.push(condition);
        continue;
      }
      
      // Token overlap (medium weight)
      const overlap = calculateTokenOverlap(inputTokens, conditionTokens);
      if (overlap > 0.5) {
        score += overlap * 0.6;
        matchedConditions.push(condition);
      }
    }
    
    // 2. "whenToUse" guidance similarity (lower weight but broader)
    if (scheme.whenToUse) {
      const whenToUseTokens = tokenize(scheme.whenToUse.toLowerCase());
      const whenToUseOverlap = calculateTokenOverlap(inputTokens, whenToUseTokens);
      
      if (whenToUseOverlap > 0.3) {
        score += whenToUseOverlap * 0.3;
      }
    }
    
    // 3. Tag matching (context clues)
    for (const tag of scheme.tags) {
      if (normalizedInput.includes(tag.toLowerCase())) {
        score += 0.2;
      }
    }
    
    // 4. Difficulty preference bonus
    if (preferDifficulty && scheme.difficulty === preferDifficulty) {
      score += 0.1;
    }
    
    // Only include if meets minimum threshold
    if (score >= minScore) {
      matches.push({
        schemeId: scheme.id,
        schemeKey: scheme.key,
        schemeName: scheme.name,
        score,
        matchedConditions,
        whenToUse: scheme.whenToUse,
        difficulty: scheme.difficulty,
        tags: scheme.tags,
      });
    }
  }
  
  // Sort by score (descending) and limit results
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Tokenizes text into meaningful words (removes stop words)
 */
function tokenize(text: string): Set<string> {
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "should",
    "could", "may", "might", "must", "can", "to", "of", "in", "on", "at",
    "by", "for", "with", "from", "and", "or", "but", "not", "this", "that",
  ]);
  
  const words = text
    .replace(/[^\w\s]/g, " ") // Remove punctuation
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
  
  return new Set(words);
}

/**
 * Calculates token overlap between two sets (Jaccard similarity)
 */
function calculateTokenOverlap(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Suggests schemes based on keywords (simpler, faster)
 */
export function suggestSchemesByKeywords(
  keywords: string[],
  allSchemes: Array<{
    id: string;
    key: string;
    name: string;
    identificationConditions: string[];
    tags: string[];
  }>,
  maxResults = 5
): SchemeMatch[] {
  const normalizedKeywords = keywords.map((k) => k.toLowerCase());
  const matches: SchemeMatch[] = [];
  
  for (const scheme of allSchemes) {
    let score = 0;
    const matchedConditions: string[] = [];
    
    // Check identification conditions
    for (const condition of scheme.identificationConditions) {
      const normalizedCondition = condition.toLowerCase();
      
      for (const keyword of normalizedKeywords) {
        if (normalizedCondition.includes(keyword)) {
          score += 1.0;
          matchedConditions.push(condition);
          break;
        }
      }
    }
    
    // Check tags
    for (const tag of scheme.tags) {
      if (normalizedKeywords.includes(tag.toLowerCase())) {
        score += 0.5;
      }
    }
    
    if (score > 0) {
      matches.push({
        schemeId: scheme.id,
        schemeKey: scheme.key,
        schemeName: scheme.name,
        score,
        matchedConditions,
        whenToUse: "",
        difficulty: "",
        tags: scheme.tags,
      });
    }
  }
  
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Common identification patterns for quick lookup
 */
export const COMMON_PATTERNS = {
  authority: [
    "source has expertise",
    "expert testimony",
    "credentials mentioned",
    "authority cited",
  ],
  causation: [
    "cause and effect",
    "leads to outcome",
    "produces result",
    "explains why",
  ],
  analogy: [
    "similar situation",
    "like another case",
    "comparable example",
    "resembles",
  ],
  consequences: [
    "predicting outcome",
    "future impact",
    "will result in",
    "consequences of action",
  ],
  signs: [
    "indicator of",
    "evidence suggests",
    "symptom of",
    "shows that",
  ],
  classification: [
    "belongs to category",
    "type of",
    "instance of",
    "classified as",
  ],
  definition: [
    "meaning of term",
    "what something is",
    "defining characteristic",
    "by definition",
  ],
  values: [
    "moral principle",
    "ethical consideration",
    "what is good",
    "value judgment",
  ],
} as const;

/**
 * Gets pattern category for a given scheme key
 */
export function getPatternCategory(schemeKey: string): keyof typeof COMMON_PATTERNS | null {
  const lowerKey = schemeKey.toLowerCase();
  
  if (lowerKey.includes("authority") || lowerKey.includes("expert")) {
    return "authority";
  }
  if (lowerKey.includes("cause") || lowerKey.includes("causal")) {
    return "causation";
  }
  if (lowerKey.includes("analog") || lowerKey.includes("similar")) {
    return "analogy";
  }
  if (lowerKey.includes("consequence") || lowerKey.includes("effect")) {
    return "consequences";
  }
  if (lowerKey.includes("sign") || lowerKey.includes("evidence")) {
    return "signs";
  }
  if (lowerKey.includes("classif") || lowerKey.includes("category")) {
    return "classification";
  }
  if (lowerKey.includes("definition") || lowerKey.includes("meaning")) {
    return "definition";
  }
  if (lowerKey.includes("value") || lowerKey.includes("ethical")) {
    return "values";
  }
  
  return null;
}
