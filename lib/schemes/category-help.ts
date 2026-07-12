/**
 * Category Help Content
 * 
 * Descriptive text explaining each condition category to help users understand
 * which patterns to look for in their arguments.
 * 
 * Week 7, Task 7.4: Explanatory Text System
 */

import type { ConditionCategory } from "./identification-conditions";

export interface CategoryHelp {
  title: string;
  description: string;
  whenToUse: string;
  examples: string[];
  tips: string[];
}

/**
 * Detailed help content for each category
 */
export const categoryHelpContent: Record<ConditionCategory, CategoryHelp> = {
  source_type: {
    title: "Source Type",
    description:
      "These conditions identify where the argument's evidence comes from. Does it cite experts, popular opinion, witnesses, or empirical evidence?",
    whenToUse:
      "Use these conditions when you notice the argument is making claims based on who said something or what source the information comes from.",
    examples: [
      "\"According to Dr. Smith, a leading climate scientist...\" → Appeals to expert",
      "\"Everyone knows that...\" or \"Most people believe...\" → Appeals to popularity",
      "\"I saw it happen\" or \"The witness testified...\" → Cites witness",
      "\"Studies show...\" or \"The data indicates...\" → Uses evidence",
    ],
    tips: [
      "Look for phrases like 'according to', 'experts say', 'studies show'",
      "Pay attention to who or what is being cited as authority",
      "Multiple source types can appear in a single argument",
    ],
  },

  reasoning_type: {
    title: "Reasoning Type",
    description:
      "These conditions identify the logical structure of the argument. Is it based on cause and effect, analogy, classification, or consequences?",
    whenToUse:
      "Use these conditions when you can identify the logical pattern connecting premises to conclusion.",
    examples: [
      "\"If we do X, then Y will happen\" → Argues consequences",
      "\"X caused Y\" or \"Because of X, Y occurred\" → Argues causation",
      "\"X is like Y, so what's true for X is true for Y\" → Uses analogy",
      "\"X is a type of Y\" or \"X belongs to category Y\" → Uses classification",
    ],
    tips: [
      "Look for 'if-then', 'because', 'causes', 'leads to' language",
      "Analogies often use 'like', 'similar to', 'just as'",
      "Classification involves grouping or categorizing",
    ],
  },

  argument_structure: {
    title: "Argument Structure",
    description:
      "These conditions identify structural patterns in how the argument is built. Does it have conditional steps, progressive stages, or part-whole relationships?",
    whenToUse:
      "Use these conditions when you notice the argument has a distinct structural organization or logical flow.",
    examples: [
      "\"If A, then B; if B, then C\" → Conditional structure",
      "\"First X, then Y, finally Z\" → Progressive steps",
      "\"Each part works together to form the whole\" → Part-whole reasoning",
    ],
    tips: [
      "Conditional structures chain 'if-then' statements",
      "Progressive arguments build step by step",
      "Part-whole reasoning discusses components and systems",
    ],
  },

  content_type: {
    title: "Content Type",
    description:
      "These conditions identify what the argument is about. Is it recommending an action, describing a state of affairs, or predicting the future?",
    whenToUse:
      "Use these conditions to categorize the subject matter and purpose of the argument.",
    examples: [
      "\"We should do X\" or \"You ought to Y\" → About action",
      "\"X is true\" or \"The situation is Y\" → About state",
      "\"X will happen\" or \"Y is going to occur\" → About future",
    ],
    tips: [
      "Action arguments use 'should', 'ought', 'must', 'need to'",
      "State arguments describe current or past conditions",
      "Future arguments make predictions or forecasts",
    ],
  },

  appeal_type: {
    title: "Appeal Type",
    description:
      "These conditions identify emotional or value-based appeals in the argument. Does it appeal to shared values, fear, or other emotions?",
    whenToUse:
      "Use these conditions when the argument goes beyond logic to invoke values, emotions, or shared beliefs.",
    examples: [
      "\"This violates our principles\" or \"This is the right thing to do\" → Appeals to values",
      "\"If we don't act, terrible things will happen\" → Appeals to fear",
    ],
    tips: [
      "Value appeals reference morals, ethics, or principles",
      "Fear appeals emphasize negative consequences or dangers",
      "These often combine with logical reasoning",
    ],
  },

  relationship: {
    title: "Relationship",
    description:
      "These conditions identify how the argument establishes connections between ideas. Does it show similarity, cite precedent, reveal inconsistency, or address relevance?",
    whenToUse:
      "Use these conditions when the argument's strength depends on relationships between cases, ideas, or principles.",
    examples: [
      "\"This case is similar to that case\" → Shows similarity",
      "\"We did X before, so we should do it again\" → Cites precedent",
      "\"You said X, but you're doing Y\" → Shows inconsistency",
      "\"That's not relevant to the issue\" → Addresses relevance",
    ],
    tips: [
      "Similarity arguments compare and find commonalities",
      "Precedent arguments reference past decisions or actions",
      "Inconsistency arguments point out contradictions",
      "Relevance arguments focus on what matters",
    ],
  },
};

/**
 * Get help content for a specific category
 */
export function getCategoryHelp(category: ConditionCategory): CategoryHelp {
  return categoryHelpContent[category];
}

/**
 * Get all category titles for display
 */
export function getCategoryTitles(): Record<ConditionCategory, string> {
  return Object.entries(categoryHelpContent).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: value.title,
    }),
    {} as Record<ConditionCategory, string>
  );
}
