// lib/confidence/dempsterShafer.ts

/**
 * Dempster-Shafer Theory of Evidence implementation for argument confidence.
 * 
 * DS theory extends Bayesian probability by allowing representation of uncertainty
 * through belief mass assignment to sets of hypotheses (frame of discernment).
 * 
 * Key Concepts:
 * - Belief (Bel): Lower bound of confidence - mass directly supporting hypothesis
 * - Plausibility (Pl): Upper bound of confidence - mass not contradicting hypothesis
 * - Uncertainty: Interval [Bel, Pl] represents epistemic uncertainty
 * 
 * For an argument A:
 * - Bel(A) = sum of masses assigned to subsets supporting A
 * - Pl(A) = 1 - Bel(¬A) = sum of masses not contradicting A
 * - Uncertainty = Pl(A) - Bel(A)
 */

/**
 * Mass assignment for a hypothesis in the frame of discernment.
 */
export interface MassAssignment {
  hypothesis: string; // "A" (for), "not-A" (against), "A-or-not-A" (uncertain)
  mass: number; // Value in [0, 1], sum of all masses = 1
  source?: string; // Source of evidence (e.g., argument ID, scheme)
}

/**
 * Frame of discernment for Dempster-Shafer analysis.
 * For binary argument evaluation: Θ = {A, ¬A}
 */
export interface FrameOfDiscernment {
  theta: string[]; // ["A", "not-A"]
  masses: MassAssignment[];
}

/**
 * Result of DS computation for an argument.
 */
export interface DSResult {
  belief: number; // Bel(A) - lower bound of confidence
  plausibility: number; // Pl(A) - upper bound of confidence
  uncertainty: number; // Pl(A) - Bel(A) - epistemic uncertainty
  massDistribution: MassAssignment[];
}

/**
 * Compute belief (Bel) for a hypothesis.
 * Belief is the sum of masses assigned to subsets that imply the hypothesis.
 * 
 * For hypothesis A:
 * Bel(A) = m(A) = sum of masses directly supporting A
 * 
 * @param hypothesis - The hypothesis to compute belief for (e.g., "A")
 * @param masses - Array of mass assignments
 * @returns Belief value in [0, 1]
 */
export function computeBelief(
  hypothesis: string,
  masses: MassAssignment[]
): number {
  // Belief is the sum of masses assigned to subsets that imply the hypothesis
  // For binary frame {A, ¬A}, Bel(A) = m(A)
  const supportingMass = masses
    .filter((m) => m.hypothesis === hypothesis)
    .reduce((sum, m) => sum + m.mass, 0);

  return Math.max(0, Math.min(1, supportingMass)); // Clamp to [0, 1]
}

/**
 * Compute plausibility (Pl) for a hypothesis.
 * Plausibility is 1 minus the belief in the negation of the hypothesis.
 * 
 * For hypothesis A:
 * Pl(A) = 1 - Bel(¬A) = m(A) + m(Θ)
 * Where Θ is the uncertainty mass (neither A nor ¬A committed)
 * 
 * @param hypothesis - The hypothesis to compute plausibility for (e.g., "A")
 * @param masses - Array of mass assignments
 * @returns Plausibility value in [0, 1]
 */
export function computePlausibility(
  hypothesis: string,
  masses: MassAssignment[]
): number {
  // Plausibility = 1 - Bel(¬hypothesis)
  // = 1 - m(¬A) = m(A) + m(Θ)
  
  const negation = hypothesis === "A" ? "not-A" : "A";
  const contradictingMass = masses
    .filter((m) => m.hypothesis === negation)
    .reduce((sum, m) => sum + m.mass, 0);

  const plausibility = 1 - contradictingMass;
  return Math.max(0, Math.min(1, plausibility)); // Clamp to [0, 1]
}

/**
 * Compute full Dempster-Shafer result (belief, plausibility, uncertainty).
 * 
 * @param hypothesis - The hypothesis to analyze (typically "A" for an argument)
 * @param masses - Array of mass assignments
 * @returns DS result with belief, plausibility, and uncertainty interval
 */
export function computeDSResult(
  hypothesis: string,
  masses: MassAssignment[]
): DSResult {
  const belief = computeBelief(hypothesis, masses);
  const plausibility = computePlausibility(hypothesis, masses);
  const uncertainty = plausibility - belief;

  return {
    belief,
    plausibility,
    uncertainty,
    massDistribution: masses,
  };
}

/**
 * Convert argument support/attack structure to mass assignments.
 * 
 * This is a simplified heuristic for converting Mesh's argument graph
 * into DS mass assignments:
 * - Supporting arguments contribute mass to "A"
 * - Attacking arguments (rebuttals/undercuts) contribute mass to "not-A"
 * - Unresolved attacks or weak evidence contribute to uncertainty mass
 * 
 * @param supports - Number of supporting arguments
 * @param attacks - Number of attacking arguments
 * @param unresolved - Number of unresolved/uncertain relations
 * @returns Array of mass assignments
 */
export function argumentsToMassAssignments(
  supports: number,
  attacks: number,
  unresolved: number = 0
): MassAssignment[] {
  const total = supports + attacks + unresolved;

  if (total === 0) {
    // No evidence - maximum uncertainty
    return [
      { hypothesis: "A-or-not-A", mass: 1.0, source: "no-evidence" },
    ];
  }

  // Distribute mass proportionally
  const masses: MassAssignment[] = [];

  if (supports > 0) {
    masses.push({
      hypothesis: "A",
      mass: supports / total,
      source: "support-arguments",
    });
  }

  if (attacks > 0) {
    masses.push({
      hypothesis: "not-A",
      mass: attacks / total,
      source: "attack-arguments",
    });
  }

  if (unresolved > 0) {
    masses.push({
      hypothesis: "A-or-not-A",
      mass: unresolved / total,
      source: "uncertainty",
    });
  }

  return masses;
}

/**
 * Combine two independent mass assignments using Dempster's rule of combination.
 * 
 * m₁₂(C) = [Σ_{A∩B=C} m₁(A) × m₂(B)] / (1 - K)
 * where K = Σ_{A∩B=∅} m₁(A) × m₂(B) (conflict mass)
 * 
 * This is a simplified version for binary frame {A, ¬A}.
 * 
 * @param masses1 - First set of mass assignments
 * @param masses2 - Second set of mass assignments
 * @returns Combined mass assignments
 */
export function combineMasses(
  masses1: MassAssignment[],
  masses2: MassAssignment[]
): MassAssignment[] {
  // Extract masses by hypothesis
  const m1_A = masses1.find((m) => m.hypothesis === "A")?.mass || 0;
  const m1_notA = masses1.find((m) => m.hypothesis === "not-A")?.mass || 0;
  const m1_theta = masses1.find((m) => m.hypothesis === "A-or-not-A")?.mass || 0;

  const m2_A = masses2.find((m) => m.hypothesis === "A")?.mass || 0;
  const m2_notA = masses2.find((m) => m.hypothesis === "not-A")?.mass || 0;
  const m2_theta = masses2.find((m) => m.hypothesis === "A-or-not-A")?.mass || 0;

  // Calculate conflict (K) - mass assigned to empty set
  const K = m1_A * m2_notA + m1_notA * m2_A;

  if (K >= 1.0) {
    // Total conflict - cannot combine
    throw new Error("Total conflict in mass assignments - cannot combine");
  }

  const normalization = 1 / (1 - K);

  // Apply Dempster's rule
  const combined_A = (m1_A * m2_A + m1_A * m2_theta + m1_theta * m2_A) * normalization;
  const combined_notA = (m1_notA * m2_notA + m1_notA * m2_theta + m1_theta * m2_notA) * normalization;
  const combined_theta = (m1_theta * m2_theta) * normalization;

  const result: MassAssignment[] = [];

  if (combined_A > 0) {
    result.push({ hypothesis: "A", mass: combined_A, source: "combined" });
  }

  if (combined_notA > 0) {
    result.push({ hypothesis: "not-A", mass: combined_notA, source: "combined" });
  }

  if (combined_theta > 0) {
    result.push({ hypothesis: "A-or-not-A", mass: combined_theta, source: "combined" });
  }

  return result;
}

/**
 * Validate that mass assignments sum to 1 (within tolerance).
 * 
 * @param masses - Array of mass assignments
 * @param tolerance - Allowed deviation from 1.0 (default: 0.0001)
 * @returns True if valid
 */
export function validateMasses(
  masses: MassAssignment[],
  tolerance: number = 0.0001
): boolean {
  const sum = masses.reduce((total, m) => total + m.mass, 0);
  return Math.abs(sum - 1.0) < tolerance;
}
