// Shared rule parser for both frontend and backend
// Supports: "A & B -> C", "A,B=>C", "A -> not X", "A & ¬B -> C"

export type ParsedRule = {
  ifAll: string[];
  then: string;
};

function norm(s?: string): string {
  return String(s ?? '').trim();
}

/**
 * Parse a rule string into preconditions and consequent.
 * 
 * Supported formats:
 * - "A -> B"               (single precondition)
 * - "A & B -> C"           (conjunction with &)
 * - "A, B -> C"            (conjunction with comma)
 * - "A => B"               (alternative arrow)
 * - "A & not B -> C"       (negation in precondition)
 * - "A -> not B"           (negation in consequent)
 * - "A & ¬B -> C"          (Unicode negation)
 * 
 * @param ruleText - Raw rule string
 * @returns Parsed rule or null if invalid syntax
 */
export function parseRule(ruleText: string): ParsedRule | null {
  const raw = norm(ruleText);
  
  // Detect separator (-> or =>)
  const separator = raw.includes('->') ? '->' : 
                    raw.includes('=>') ? '=>' : 
                    null;
  
  if (!separator) {
    return null; // No valid arrow found
  }
  
  const parts = raw.split(separator);
  if (parts.length !== 2) {
    return null; // Multiple arrows or malformed
  }
  
  const [lhs, rhs] = parts;
  
  // Parse left-hand side (preconditions)
  // Split by comma or ampersand
  const ifAll = lhs
    .split(/[,&]/)
    .map(norm)
    .filter(Boolean);
  
  // Parse right-hand side (consequent)
  const then = norm(rhs);
  
  // Validation
  if (ifAll.length === 0 || !then) {
    return null;
  }
  
  return { ifAll, then };
}

/**
 * Validate a rule and return helpful error message.
 * 
 * @param ruleText - Raw rule string
 * @returns Error message or null if valid
 */
export function validateRule(ruleText: string): string | null {
  const raw = norm(ruleText);
  
  if (!raw) {
    return "Rule cannot be empty";
  }
  
  if (!raw.includes('->') && !raw.includes('=>')) {
    return "Rule must contain '->' or '=>' arrow";
  }
  
  const arrowCount = (raw.match(/->/g) || []).length + (raw.match(/=>/g) || []).length;
  if (arrowCount > 1) {
    return "Rule cannot contain multiple arrows";
  }
  
  const parsed = parseRule(ruleText);
  if (!parsed) {
    return "Invalid rule syntax";
  }
  
  if (parsed.ifAll.some(p => !p.trim())) {
    return "Preconditions cannot be empty";
  }
  
  if (!parsed.then.trim()) {
    return "Consequent cannot be empty";
  }
  
  return null; // Valid
}

/**
 * Format a parsed rule back to string (for display).
 */
export function formatRule(parsed: ParsedRule): string {
  return `${parsed.ifAll.join(' & ')} -> ${parsed.then}`;
}

/**
 * Check if a fact is a negation.
 * Supports: "not X", "¬X", "~X", "!X"
 */
export function isNegation(fact: string): boolean {
  const normalized = norm(fact);
  return /^not[\s_]+/.test(normalized) || 
         normalized.startsWith('¬') ||
         normalized.startsWith('~') ||
         normalized.startsWith('!');
}

/**
 * Strip negation prefix from fact.
 * "not traffic_good" -> "traffic_good"
 * "¬traffic_good" -> "traffic_good"
 */
export function stripNegation(fact: string): string {
  const normalized = norm(fact);
  return normalized
    .replace(/^not[\s_]+/, '')
    .replace(/^¬/, '')
    .replace(/^~/, '')
    .replace(/^!/, '')
    .trim();
}
