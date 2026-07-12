/**
 * Dialogue-layer Contradiction Detection
 * 
 * Ported from ludics-engine interactCE() to detect contradictions
 * in dialogue commitments without requiring ludics formalization.
 * 
 * Detection Strategy:
 * 1. Parse active commitments into positive/negative sets
 * 2. Normalize claim text for comparison
 * 3. Detect explicit negations ("not X", "¬X", etc.)
 * 4. Detect semantic negations ("X is true" vs "X is false")
 * 5. Check for contradictions: X ∧ ¬X
 * 6. Return list of contradictory pairs with confidence scores
 */

/**
 * Normalized representation of a commitment for contradiction analysis
 */
export interface NormalizedCommitment {
  claimId: string;
  claimText: string;
  normalizedText: string;
  isNegated: boolean;
  baseText: string;  // Text with negation stripped
  moveId: string;
  moveKind: string;
  timestamp: Date;
}

/**
 * Contradiction between two commitments
 */
export interface Contradiction {
  claimA: {
    id: string;
    text: string;
    moveId: string;
  };
  claimB: {
    id: string;
    text: string;
    moveId: string;
  };
  reason: string;
  confidence: number;  // 0-1 score (1 = certain contradiction)
  type: "explicit_negation" | "semantic_opposition" | "contraries";
}

/**
 * Result of contradiction detection for a participant
 */
export interface ContradictionAnalysis {
  participantId: string;
  totalCommitments: number;
  positiveCommitments: number;
  negativeCommitments: number;
  contradictions: Contradiction[];
  checkedAt: Date;
}

/**
 * Simple commitment record (from getCommitmentStores)
 */
export interface CommitmentRecord {
  claimId: string;
  claimText: string;
  moveId: string;
  moveKind: string;
  timestamp: Date;
  isActive: boolean;
}

// ============================================================================
// Normalization Utilities
// ============================================================================

const NEGATION_PREFIXES = [
  "not ",
  "no ",
  "¬",
  "~",
  "!",
  "never ",
  "it is not the case that ",
  "it's not the case that ",
];

const NEGATION_INFIX_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: / cannot /i, replacement: " can " },
  { pattern: / can't /i, replacement: " can " },
  { pattern: / should not /i, replacement: " should " },
  { pattern: / shouldn't /i, replacement: " should " },
  { pattern: / must not /i, replacement: " must " },
  { pattern: / mustn't /i, replacement: " must " },
  { pattern: / does not /i, replacement: " does " },
  { pattern: / doesn't /i, replacement: " does " },
  { pattern: / do not /i, replacement: " do " },
  { pattern: / don't /i, replacement: " do " },
  { pattern: / will not /i, replacement: " will " },
  { pattern: / won't /i, replacement: " will " },
  { pattern: / would not /i, replacement: " would " },
  { pattern: / wouldn't /i, replacement: " would " },
  { pattern: / could not /i, replacement: " could " },
  { pattern: / couldn't /i, replacement: " could " },
  { pattern: / is not /i, replacement: " is " },
  { pattern: / isn't /i, replacement: " is " },
  { pattern: / are not /i, replacement: " are " },
  { pattern: / aren't /i, replacement: " are " },
];

const NEGATION_SUFFIXES = [
  " is false",
  " is untrue",
  " is incorrect",
  " is wrong",
  " is not true",
  " is not correct",
  " is not the case",
  " isn't true",
  " isn't correct",
  " isn't the case",
];

/**
 * Normalize text for comparison (lowercase, trim, collapse whitespace)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}

/**
 * Check if text has an infix negation pattern (e.g., "would not improve")
 */
function hasInfixNegation(text: string): boolean {
  const normalized = normalizeText(text);
  
  for (const { pattern } of NEGATION_INFIX_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Strip infix negation from text (replace "would not" with "would", etc.)
 */
function stripInfixNegation(text: string): string {
  let normalized = normalizeText(text);
  
  for (const { pattern, replacement } of NEGATION_INFIX_PATTERNS) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, replacement);
      break; // Only replace first match
    }
  }
  
  // Collapse whitespace after replacement
  return normalized.replace(/\s+/g, " ").trim();
}

/**
 * Check if text starts with a negation prefix
 */
function hasNegationPrefix(text: string): { hasNegation: boolean; prefix?: string } {
  const normalized = normalizeText(text);
  
  for (const prefix of NEGATION_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return { hasNegation: true, prefix };
    }
  }
  
  return { hasNegation: false };
}

/**
 * Check if text ends with a negation suffix
 */
function hasNegationSuffix(text: string): { hasNegation: boolean; suffix?: string } {
  const normalized = normalizeText(text);
  
  for (const suffix of NEGATION_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      return { hasNegation: true, suffix };
    }
  }
  
  return { hasNegation: false };
}

/**
 * Strip negation from text and return base text
 */
function stripNegation(text: string): string {
  const normalized = normalizeText(text);
  
  // Check prefixes first
  const prefixCheck = hasNegationPrefix(normalized);
  if (prefixCheck.hasNegation && prefixCheck.prefix) {
    return normalized.slice(prefixCheck.prefix.length).trim();
  }
  
  // Check suffixes
  const suffixCheck = hasNegationSuffix(normalized);
  if (suffixCheck.hasNegation && suffixCheck.suffix) {
    return normalized.slice(0, -suffixCheck.suffix.length).trim();
  }
  
  // Check infix patterns
  if (hasInfixNegation(normalized)) {
    return stripInfixNegation(normalized);
  }
  
  return normalized;
}

/**
 * Parse commitment text to determine if it's negated and extract base text
 */
function parseCommitment(text: string): { isNegated: boolean; baseText: string } {
  const normalized = normalizeText(text);
  const prefixCheck = hasNegationPrefix(normalized);
  const suffixCheck = hasNegationSuffix(normalized);
  const infixCheck = hasInfixNegation(normalized);
  
  const isNegated = prefixCheck.hasNegation || suffixCheck.hasNegation || infixCheck;
  const baseText = isNegated ? stripNegation(normalized) : normalized;
  
  return { isNegated, baseText };
}

/**
 * Convert commitment record to normalized form for analysis
 */
function normalizeCommitment(commitment: CommitmentRecord): NormalizedCommitment {
  const { isNegated, baseText } = parseCommitment(commitment.claimText);
  
  return {
    claimId: commitment.claimId,
    claimText: commitment.claimText,
    normalizedText: normalizeText(commitment.claimText),
    isNegated,
    baseText,
    moveId: commitment.moveId,
    moveKind: commitment.moveKind,
    timestamp: commitment.timestamp,
  };
}

// ============================================================================
// Contradiction Detection
// ============================================================================

/**
 * Check if two normalized commitments contradict each other
 */
function checkContradiction(
  a: NormalizedCommitment,
  b: NormalizedCommitment
): Contradiction | null {
  // Same claim can't contradict itself
  if (a.claimId === b.claimId) return null;
  
  // Both claims must refer to the same base proposition
  if (a.baseText !== b.baseText) return null;
  
  // One must be negated, the other positive
  if (a.isNegated === b.isNegated) return null;
  
  // Found contradiction: X and ¬X
  return {
    claimA: {
      id: a.claimId,
      text: a.claimText,
      moveId: a.moveId,
    },
    claimB: {
      id: b.claimId,
      text: b.claimText,
      moveId: b.moveId,
    },
    reason: a.isNegated
      ? `"${b.claimText}" contradicts "${a.claimText}"`
      : `"${a.claimText}" contradicts "${b.claimText}"`,
    confidence: 1.0,  // Exact negation = certain contradiction
    type: "explicit_negation",
  };
}

/**
 * Check for semantic contradictions using common patterns
 * Examples: "X is true" vs "X is false", "X exists" vs "X does not exist"
 */
function checkSemanticContradiction(
  a: NormalizedCommitment,
  b: NormalizedCommitment
): Contradiction | null {
  // Same claim can't contradict itself
  if (a.claimId === b.claimId) return null;
  
  const aText = a.normalizedText;
  const bText = b.normalizedText;
  
  // Extract core propositions by removing common semantic markers
  const extractCore = (text: string): string => {
    return text
      .replace(/ is true$/i, "")
      .replace(/ is false$/i, "")
      .replace(/ exists$/i, "")
      .replace(/ does not exist$/i, "")
      .replace(/ is correct$/i, "")
      .replace(/ is incorrect$/i, "")
      .replace(/ is right$/i, "")
      .replace(/ is wrong$/i, "")
      .replace(/ should happen$/i, "")
      .replace(/ should not happen$/i, "")
      .trim();
  };
  
  const aCore = extractCore(aText);
  const bCore = extractCore(bText);
  
  // Cores must match
  if (aCore !== bCore) return null;
  
  // Check for semantic opposition patterns
  const oppositionPatterns: [RegExp, RegExp][] = [
    [/ is true$/i, / is false$/i],
    [/ is correct$/i, / is incorrect$/i],
    [/ is right$/i, / is wrong$/i],
    [/ exists$/i, / does not exist$/i],
    [/ should happen$/i, / should not happen$/i],
    [/ will happen$/i, / will not happen$/i],
    [/ can happen$/i, / cannot happen$/i],
  ];
  
  for (const [pattern1, pattern2] of oppositionPatterns) {
    const aMatches1 = pattern1.test(aText);
    const bMatches2 = pattern2.test(bText);
    const aMatches2 = pattern2.test(aText);
    const bMatches1 = pattern1.test(bText);
    
    if ((aMatches1 && bMatches2) || (aMatches2 && bMatches1)) {
      return {
        claimA: {
          id: a.claimId,
          text: a.claimText,
          moveId: a.moveId,
        },
        claimB: {
          id: b.claimId,
          text: b.claimText,
          moveId: b.moveId,
        },
        reason: `"${a.claimText}" and "${b.claimText}" express opposite truth values`,
        confidence: 0.9,  // High confidence for semantic opposites
        type: "semantic_opposition",
      };
    }
  }
  
  return null;
}

/**
 * Check for contradictions among all commitments
 * Port of ludics interactCE() contradiction detection
 */
export function detectContradictions(
  commitments: CommitmentRecord[]
): Contradiction[] {
  // Only analyze active commitments
  const activeCommitments = commitments.filter(c => c.isActive);
  
  if (activeCommitments.length === 0) {
    return [];
  }
  
  // Normalize all commitments
  const normalized = activeCommitments.map(normalizeCommitment);
  
  const contradictions: Contradiction[] = [];
  const seen = new Set<string>();  // Prevent duplicate pairs
  
  // O(n²) pairwise comparison (fine for small commitment sets)
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i];
      const b = normalized[j];
      
      // Generate canonical pair key (sorted by claimId)
      const pairKey = [a.claimId, b.claimId].sort().join("|");
      if (seen.has(pairKey)) continue;
      
      // Check explicit negation
      const explicitContradiction = checkContradiction(a, b);
      if (explicitContradiction) {
        contradictions.push(explicitContradiction);
        seen.add(pairKey);
        continue;
      }
      
      // Check semantic contradiction
      const semanticContradiction = checkSemanticContradiction(a, b);
      if (semanticContradiction) {
        contradictions.push(semanticContradiction);
        seen.add(pairKey);
      }
    }
  }
  
  return contradictions;
}

/**
 * Analyze commitments for contradictions with detailed statistics
 */
export function analyzeContradictions(
  participantId: string,
  commitments: CommitmentRecord[]
): ContradictionAnalysis {
  const activeCommitments = commitments.filter(c => c.isActive);
  const normalized = activeCommitments.map(normalizeCommitment);
  
  const positiveCount = normalized.filter(c => !c.isNegated).length;
  const negativeCount = normalized.filter(c => c.isNegated).length;
  
  const contradictions = detectContradictions(commitments);
  
  return {
    participantId,
    totalCommitments: activeCommitments.length,
    positiveCommitments: positiveCount,
    negativeCommitments: negativeCount,
    contradictions,
    checkedAt: new Date(),
  };
}

/**
 * Check if a new commitment would contradict existing commitments
 * Used for real-time alerts before committing
 */
export function checkNewCommitmentContradictions(
  newClaimText: string,
  existingCommitments: CommitmentRecord[]
): Contradiction[] {
  // Create temporary commitment for the new claim
  const newCommitment: CommitmentRecord = {
    claimId: "temp-new-claim",
    claimText: newClaimText,
    moveId: "temp-new-move",
    moveKind: "ASSERT",
    timestamp: new Date(),
    isActive: true,
  };
  
  // Check against all existing active commitments
  const allCommitments = [...existingCommitments, newCommitment];
  const contradictions = detectContradictions(allCommitments);
  
  // Filter to only contradictions involving the new commitment
  return contradictions.filter(
    c => c.claimA.id === "temp-new-claim" || c.claimB.id === "temp-new-claim"
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all contradictions for a specific claim
 */
export function getContradictionsForClaim(
  claimId: string,
  allContradictions: Contradiction[]
): Contradiction[] {
  return allContradictions.filter(
    c => c.claimA.id === claimId || c.claimB.id === claimId
  );
}

/**
 * Check if a specific claim is involved in any contradictions
 */
export function hasContradictions(
  claimId: string,
  allContradictions: Contradiction[]
): boolean {
  return allContradictions.some(
    c => c.claimA.id === claimId || c.claimB.id === claimId
  );
}

/**
 * Get the other claim in a contradiction pair
 */
export function getContradictingClaim(
  claimId: string,
  contradiction: Contradiction
): { id: string; text: string; moveId: string } | null {
  if (contradiction.claimA.id === claimId) {
    return contradiction.claimB;
  }
  if (contradiction.claimB.id === claimId) {
    return contradiction.claimA;
  }
  return null;
}

/**
 * Format contradiction for display
 */
export function formatContradiction(contradiction: Contradiction): string {
  return `${contradiction.reason} (confidence: ${(contradiction.confidence * 100).toFixed(0)}%)`;
}
