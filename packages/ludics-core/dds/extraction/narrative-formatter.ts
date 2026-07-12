/**
 * ============================================
 * NARRATIVE FORMATTER
 * ============================================
 * 
 * Convert incarnation (proof trace) to human-readable justified narrative.
 * 
 * This implements the Curry-Howard correspondence for argumentation:
 * - A visitable path IS a proof
 * - The incarnation IS the essential proof
 * - The narrative IS the human-readable form of that proof
 * 
 * Output formats:
 * - Structured: JustifiedNarrative object
 * - Markdown: Formatted text for documentation
 * - JSON: Machine-readable for APIs
 * - Plain text: Simple text output
 */

import type {
  VisitablePath,
  DialogueAct,
  DeliberationArena,
  JustifiedNarrative,
  NarrativeStep,
  LudicAddress,
  ArenaPositionTheory,
} from "../types/ludics-theory";

import {
  addressToKey,
  isDaimon,
} from "../types/ludics-theory";

import { getJustificationChain, computeIncarnation } from "./incarnation";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Narrative formatting options
 */
export interface NarrativeOptions {
  /** Include step numbers */
  numbered?: boolean;

  /** Verbose justifications */
  verbose?: boolean;

  /** Include addresses in output */
  showAddresses?: boolean;

  /** Include timestamps if available */
  showTimestamps?: boolean;

  /** Custom speaker labels */
  speakerLabels?: {
    proponent?: string;
    opponent?: string;
  };

  /** Narrative style */
  style?: "formal" | "conversational" | "academic";
}

/**
 * Justification templates by style
 */
interface JustificationTemplates {
  claim: string;
  support: string;
  attack: string;
  concession: string;
  daimon: string;
  argue: string;
  negate: string;
  ask: string;
}

const FORMAL_TEMPLATES: JustificationTemplates = {
  claim: "Initial assertion: {content}",
  support: "Supporting premise: {content}",
  attack: "Counter-argument: {content}",
  concession: "Point conceded: {content}",
  daimon: "{speaker} withdraws from this position",
  argue: "Argument advanced: {content}",
  negate: "Negation asserted: {content}",
  ask: "Clarification requested: {content}",
};

const CONVERSATIONAL_TEMPLATES: JustificationTemplates = {
  claim: "{speaker} says: \"{content}\"",
  support: "{speaker} adds: \"{content}\"",
  attack: "{speaker} counters: \"{content}\"",
  concession: "{speaker} agrees: \"{content}\"",
  daimon: "{speaker} steps back from this point",
  argue: "{speaker} argues: \"{content}\"",
  negate: "{speaker} denies: \"{content}\"",
  ask: "{speaker} asks: \"{content}\"",
};

const ACADEMIC_TEMPLATES: JustificationTemplates = {
  claim: "Thesis (P{step}): {content}",
  support: "Supporting evidence (P{step}): {content}",
  attack: "Objection (P{step}): {content}",
  concession: "Concession (P{step}): {content}",
  daimon: "Position withdrawn (P{step})",
  argue: "Argument (P{step}): {content}",
  negate: "Negation (P{step}): {content}",
  ask: "Query (P{step}): {content}",
};

// ============================================================================
// NARRATIVE FORMATTING
// ============================================================================

/**
 * Format a visitable path as a justified narrative
 * 
 * This is the main function for converting a proof trace into
 * a human-readable narrative form.
 * 
 * @param path The visitable path (proof trace)
 * @param arena Optional arena for content lookup
 * @param options Formatting options
 * @returns Justified narrative
 */
export function formatAsNarrative(
  path: VisitablePath,
  arena?: DeliberationArena,
  options: NarrativeOptions = {}
): JustifiedNarrative {
  const {
    verbose = false,
    showAddresses = false,
    style = "formal",
    speakerLabels = {},
  } = options;

  const proponentLabel = speakerLabels.proponent || "Proponent";
  const opponentLabel = speakerLabels.opponent || "Opponent";

  // Use incarnation for essential narrative
  const actions = path.incarnation.length > 0 ? path.incarnation : path.actions;
  const steps: NarrativeStep[] = [];

  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    const speaker = act.polarity === "+" ? proponentLabel : opponentLabel;
    const speakerType: "Proponent" | "Opponent" = 
      act.polarity === "+" ? "Proponent" : "Opponent";

    // Get content from arena if available
    let content = act.expression;
    if (arena) {
      const position = arena.positions.get(addressToKey(act.focus));
      if (position) {
        content = position.content || act.expression;
      }
    }

    // Generate justification
    const justification = deriveJustification(
      act,
      actions.slice(0, i),
      { speaker, content, step: i + 1, style, verbose }
    );

    // Determine step type
    let stepType: NarrativeStep["type"] = mapActTypeToStepType(act.type);

    steps.push({
      position: content,
      justification,
      speaker: speakerType,
      type: stepType,
      address: showAddresses ? act.focus : undefined,
    } as NarrativeStep);
  }

  // Derive conclusion
  const conclusion = deriveConclusion(steps, path);

  // Build justification chain
  const justificationChain = steps.map((s) => s.justification);

  return {
    steps,
    conclusion,
    justificationChain,
  };
}

/**
 * Derive justification text for a step
 */
export function deriveJustification(
  act: DialogueAct,
  previousActs: DialogueAct[],
  context: {
    speaker: string;
    content: string;
    step: number;
    style: NarrativeOptions["style"];
    verbose: boolean;
  }
): string {
  const { speaker, content, step, style, verbose } = context;
  const templates = getTemplates(style || "formal");

  // Get the appropriate template
  const templateKey = act.type as keyof JustificationTemplates;
  let template = templates[templateKey] || templates.claim;

  // If it's a daimon, use daimon template
  if (isDaimon(act)) {
    template = templates.daimon;
  }

  // Replace placeholders
  let result = template
    .replace("{speaker}", speaker)
    .replace("{content}", content)
    .replace("{step}", String(step));

  // Add verbose justification if requested
  if (verbose && previousActs.length > 0) {
    const lastAct = previousActs[previousActs.length - 1];
    result += ` (in response to "${lastAct.expression}")`;
  }

  return result;
}

/**
 * Derive conclusion from narrative steps
 */
export function deriveConclusion(
  steps: NarrativeStep[],
  path: VisitablePath
): string {
  if (steps.length === 0) {
    return "No conclusion (empty interaction)";
  }

  const lastStep = steps[steps.length - 1];
  const winner = path.winner;

  if (path.convergent) {
    // Daimon played - explicit concession
    if (winner === "P") {
      return `The Opponent concedes. The Proponent's position is justified: "${findRootClaim(steps)}"`;
    } else {
      return `The Proponent concedes. The Opponent's challenge stands.`;
    }
  } else {
    // Divergent - someone stuck
    if (winner === "P") {
      return `The Opponent is unable to respond. The Proponent's argument prevails: "${findRootClaim(steps)}"`;
    } else if (winner === "O") {
      return `The Proponent is unable to respond. The Opponent's challenge prevails.`;
    } else {
      return `The interaction ends without a clear resolution.`;
    }
  }
}

/**
 * Find the root claim from narrative steps
 */
function findRootClaim(steps: NarrativeStep[]): string {
  const claim = steps.find((s) => s.type === "claim");
  return claim?.position || steps[0]?.position || "the initial position";
}

/**
 * Map dialogue act type to narrative step type
 */
function mapActTypeToStepType(actType: DialogueAct["type"]): NarrativeStep["type"] {
  switch (actType) {
    case "claim":
    case "argue":
      return "claim";
    case "negate":
    case "ask":
      return "attack";
    case "concede":
    case "daimon":
      return "concession";
    default:
      return "claim";
  }
}

/**
 * Get templates for a style
 */
function getTemplates(style: NarrativeOptions["style"]): JustificationTemplates {
  switch (style) {
    case "conversational":
      return CONVERSATIONAL_TEMPLATES;
    case "academic":
      return ACADEMIC_TEMPLATES;
    case "formal":
    default:
      return FORMAL_TEMPLATES;
  }
}

// ============================================================================
// OUTPUT FORMATS
// ============================================================================

/**
 * Convert narrative to Markdown format
 */
export function narrativeToMarkdown(
  narrative: JustifiedNarrative,
  options: NarrativeOptions = {}
): string {
  const { numbered = true } = options;
  const lines: string[] = [];

  lines.push("# Argument Narrative\n");

  if (numbered) {
    for (let i = 0; i < narrative.steps.length; i++) {
      const step = narrative.steps[i];
      lines.push(`${i + 1}. **${step.speaker}** (${step.type}): ${step.position}`);
      lines.push(`   - *${step.justification}*`);
      lines.push("");
    }
  } else {
    for (const step of narrative.steps) {
      lines.push(`- **${step.speaker}** (${step.type}): ${step.position}`);
      lines.push(`  - *${step.justification}*`);
      lines.push("");
    }
  }

  lines.push("## Conclusion\n");
  lines.push(narrative.conclusion);

  return lines.join("\n");
}

/**
 * Convert narrative to JSON format
 */
export function narrativeToJSON(narrative: JustifiedNarrative): object {
  return {
    steps: narrative.steps.map((step, index) => ({
      index: index + 1,
      speaker: step.speaker,
      type: step.type,
      position: step.position,
      justification: step.justification,
    })),
    conclusion: narrative.conclusion,
    justificationChain: narrative.justificationChain,
    metadata: {
      stepCount: narrative.steps.length,
      speakers: [...new Set(narrative.steps.map((s) => s.speaker))],
      types: [...new Set(narrative.steps.map((s) => s.type))],
    },
  };
}

/**
 * Convert narrative to plain text format
 */
export function narrativeToPlainText(
  narrative: JustifiedNarrative,
  options: NarrativeOptions = {}
): string {
  const { numbered = true } = options;
  const lines: string[] = [];

  lines.push("ARGUMENT NARRATIVE");
  lines.push("==================\n");

  for (let i = 0; i < narrative.steps.length; i++) {
    const step = narrative.steps[i];
    const prefix = numbered ? `${i + 1}. ` : "- ";
    lines.push(`${prefix}${step.speaker} (${step.type}):`);
    lines.push(`   "${step.position}"`);
    lines.push(`   [${step.justification}]`);
    lines.push("");
  }

  lines.push("CONCLUSION");
  lines.push("----------");
  lines.push(narrative.conclusion);

  return lines.join("\n");
}

/**
 * Convert narrative to HTML format
 */
export function narrativeToHTML(
  narrative: JustifiedNarrative,
  options: NarrativeOptions = {}
): string {
  const { numbered = true } = options;
  const lines: string[] = [];

  lines.push("<div class=\"argument-narrative\">");
  lines.push("  <h2>Argument Narrative</h2>");
  
  const listTag = numbered ? "ol" : "ul";
  lines.push(`  <${listTag} class="narrative-steps">`);

  for (const step of narrative.steps) {
    const speakerClass = step.speaker.toLowerCase();
    const typeClass = step.type;
    
    lines.push(`    <li class="step ${speakerClass} ${typeClass}">`);
    lines.push(`      <span class="speaker">${step.speaker}</span>`);
    lines.push(`      <span class="type">(${step.type})</span>`);
    lines.push(`      <p class="position">${escapeHTML(step.position)}</p>`);
    lines.push(`      <p class="justification"><em>${escapeHTML(step.justification)}</em></p>`);
    lines.push("    </li>");
  }

  lines.push(`  </${listTag}>`);
  lines.push("  <div class=\"conclusion\">");
  lines.push(`    <h3>Conclusion</h3>`);
  lines.push(`    <p>${escapeHTML(narrative.conclusion)}</p>`);
  lines.push("  </div>");
  lines.push("</div>");

  return lines.join("\n");
}

/**
 * Escape HTML special characters
 */
function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// NARRATIVE ANALYSIS
// ============================================================================

/**
 * Analyze a narrative for structure and content
 */
export function analyzeNarrative(narrative: JustifiedNarrative): {
  stepCount: number;
  proponentSteps: number;
  opponentSteps: number;
  claimCount: number;
  supportCount: number;
  attackCount: number;
  concessionCount: number;
  turnCount: number;
  longestExchange: number;
} {
  const steps = narrative.steps;

  const proponentSteps = steps.filter((s) => s.speaker === "Proponent").length;
  const opponentSteps = steps.filter((s) => s.speaker === "Opponent").length;
  const claimCount = steps.filter((s) => s.type === "claim").length;
  const supportCount = steps.filter((s) => s.type === "support").length;
  const attackCount = steps.filter((s) => s.type === "attack").length;
  const concessionCount = steps.filter((s) => s.type === "concession").length;

  // Count turns (speaker changes)
  let turnCount = 0;
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].speaker !== steps[i - 1].speaker) {
      turnCount++;
    }
  }

  // Find longest exchange (consecutive steps by same speaker)
  let longestExchange = 1;
  let currentExchange = 1;
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].speaker === steps[i - 1].speaker) {
      currentExchange++;
      longestExchange = Math.max(longestExchange, currentExchange);
    } else {
      currentExchange = 1;
    }
  }

  return {
    stepCount: steps.length,
    proponentSteps,
    opponentSteps,
    claimCount,
    supportCount,
    attackCount,
    concessionCount,
    turnCount,
    longestExchange,
  };
}

/**
 * Compare two narratives
 */
export function compareNarratives(
  n1: JustifiedNarrative,
  n2: JustifiedNarrative
): {
  sameLength: boolean;
  commonSteps: number;
  divergencePoint: number;
  similarConclusion: boolean;
} {
  const minLen = Math.min(n1.steps.length, n2.steps.length);
  
  let commonSteps = 0;
  let divergencePoint = -1;
  
  for (let i = 0; i < minLen; i++) {
    if (
      n1.steps[i].speaker === n2.steps[i].speaker &&
      n1.steps[i].type === n2.steps[i].type &&
      n1.steps[i].position === n2.steps[i].position
    ) {
      commonSteps++;
    } else if (divergencePoint === -1) {
      divergencePoint = i;
    }
  }

  if (divergencePoint === -1 && n1.steps.length !== n2.steps.length) {
    divergencePoint = minLen;
  }

  // Simple conclusion similarity (could use more sophisticated comparison)
  const similarConclusion = n1.conclusion === n2.conclusion;

  return {
    sameLength: n1.steps.length === n2.steps.length,
    commonSteps,
    divergencePoint,
    similarConclusion,
  };
}
