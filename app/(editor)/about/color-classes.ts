// Shared color class map used by about/details and about/landing pages
export const colorClasses = {
  indigo: {
    bg: "from-sky-50/30 to-sky-300/10",
    border: "border-sky-200/60",
    text: "text-sky-700",
    badge: "bg-sky-100/80 text-sky-700 border-sky-200/60",
    icon: "text-sky-500",
  },
  purple: {
    bg: "from-indigo-50/30 to-indigo-300/10",
    border: "border-indigo-200/60",
    text: "text-indigo-700",
    badge: "bg-indigo-100/80 text-indigo-700 border-indigo-200/60",
    icon: "text-indigo-500",
  },
  rose: {
    bg: "from-rose-50/30 to-rose-300/10",
    border: "border-rose-200/60",
    text: "text-rose-700",
    badge: "bg-rose-100/80 text-rose-700 border-rose-200/60",
    icon: "text-rose-500",
  },
  amber: {
    bg: "from-orange-50/30 to-orange-300/10",
    border: "border-orange-200/60",
    text: "text-orange-700",
    badge: "bg-orange-100/80 text-orange-700 border-orange-200/60",
    icon: "text-orange-500",
  },
  emerald: {
    bg: "from-emerald-50/30 to-emerald-300/10",
    border: "border-emerald-200/60",
    text: "text-emerald-700",
    badge: "bg-emerald-100/80 text-emerald-700 border-emerald-200/60",
    icon: "text-emerald-500",
  },
  cyan: {
    bg: "from-cyan-50/30 to-cyan-300/10",
    border: "border-cyan-200/60",
    text: "text-cyan-700",
    badge: "bg-cyan-100/80 text-cyan-700 border-cyan-200/60",
    icon: "text-cyan-500",
  },
  violet: {
    bg: "from-violet-50/30 to-violet-300/10",
    border: "border-violet-200/60",
    text: "text-violet-700",
    badge: "bg-violet-100/80 text-violet-700 border-violet-200/60",
    icon: "text-violet-500",
  },
  pink: {
    bg: "from-pink-50/30 to-pink-300/10",
    border: "border-pink-200/60",
    text: "text-pink-700",
    badge: "bg-pink-100/80 text-pink-700 border-pink-200/60",
    icon: "text-pink-500",
  },
};

// foundationCategories extracted from details/page.tsx
export const foundationCategories = [
  {
    id: 'core',
    title: 'Core Argumentation Theory',
    description: 'Foundational models for argument structure, schemes, and validity',
    color: 'indigo',
    sources: [
      { 
        cite: "Toulmin (1958)", 
        title: "The Uses of Argument",
        impl: "Claim + ArgumentDiagram",
        detail: "Warrant-based argument structure with data, claim, backing, rebuttal"
      },
      { 
        cite: "Walton et al. (2008)", 
        title: "Argumentation Schemes",
        impl: "ArgumentScheme + CQStatus + CriticalQuestion",
        detail: "Scheme templates with critical questions for systematic evaluation"
      },
      { 
        cite: "Macagno et al.", 
        title: "Argumentation Schemes: History, Classifications, and Computational Applications",
        impl: "SchemeLibrary + SchemeClassification",
        detail: "Comprehensive taxonomy of reasoning patterns and fallacy detection"
      },
      { 
        cite: "Lumer", 
        title: "A Theory of Philosophical Arguments",
        impl: "ArgumentValidity + EpistemicJustification",
        detail: "Epistemological approach to argument adequacy and validation"
      },
      { 
        cite: "Lumer", 
        title: "Structure and Function of Argumentations",
        impl: "ArgumentFunction + ValidityCriteria",
        detail: "Epistemological criteria for determining argument validity and adequacy"
      },
    ]
  },
  {
    id: 'formal',
    title: 'Abstract Argumentation & Semantics',
    description: 'Formal frameworks for argument acceptance, attack relations, and extensions',
    color: 'purple',
    sources: [
      { 
        cite: "Dung (1995)", 
        title: "On the Acceptability of Arguments",
        impl: "ClaimLabel + ArgumentExtension + AF.grounded/preferred/stable",
        detail: "Abstract argumentation frameworks with extension-based semantics"
      },
      { 
        cite: "Simari & Loui", 
        title: "A Mathematical Treatment of Defeasible Reasoning",
        impl: "DefeasibleRule + ArgumentStrength + Specificity",
        detail: "Formal defeasible logic with specificity-based conflict resolution"
      },
      { 
        cite: "Ambler", 
        title: "A Categorical Approach to the Semantics of Argumentation",
        impl: "ArgumentCategory + ConfidenceMeasure + EvidentialClosure",
        detail: "Category theory foundations: arguments as morphisms in enriched categories"
      },
      { 
        cite: "Caminada", 
        title: "Argumentation Semantics as Formal Discussion",
        impl: "DiscussionSemantics + LabelingFunction",
        detail: "Formal discussion framework mapping dialogue to extension semantics"
      },
      { 
        cite: "Bernreiter & Maly", 
        title: "Combining Voting and Abstract Argumentation",
        impl: "VotingAggregation + ArgumentRanking",
        detail: "Integration of social choice theory with argumentation frameworks"
      },
      { 
        cite: "Matt", 
        title: "A Game-Theoretic Perspective on Argument Strength",
        impl: "ArgumentGame + StrengthMeasure",
        detail: "Game-theoretic analysis of argument strength in abstract argumentation"
      },
    ]
  },
  {
    id: 'dialogue',
    title: 'Dialogue Systems & Protocol',
    description: 'Formal dialogue games, move types, protocol enforcement, and termination',
    color: 'rose',
    sources: [
      { 
        cite: "Prakken & Sartor (1997)", 
        title: "Argument-Based Extended Logic Programming",
        impl: "DialogueMove + ProofMode + Commitment",
        detail: "Formal dialogue protocols with speech acts and commitment management"
      },
      { 
        cite: "Prakken", 
        title: "On Dialogue Systems with Speech Acts, Arguments, and Counterarguments",
        impl: "SpeechAct + MoveType + DialogueProtocol",
        detail: "Dialogue system combining speech acts with argumentation moves"
      },
      { 
        cite: "McBurney & Parsons", 
        title: "A Denotational Semantics for Deliberation Dialogues",
        impl: "DeliberationProtocol + DialogueSemantics",
        detail: "Formal semantics for multi-party deliberation with shared goals"
      },
      { 
        cite: "McBurney & Parsons", 
        title: "The Eightfold Way of Deliberation Dialogue",
        impl: "DeliberationPhase + DialogueType",
        detail: "Eight-phase model for structured deliberation: open, inform, propose, consider, revise, recommend, confirm, close"
      },
      { 
        cite: "Bodenstaff et al.", 
        title: "On Formalising Dialogue Systems in Event Calculus",
        impl: "EventCalculus + DialogueState",
        detail: "Event calculus formalization of dialogue dynamics and state transitions"
      },
      { 
        cite: "Thang et al.", 
        title: "Towards Argument-based Foundation for Sceptical and Credulous Dialogue Games",
        impl: "DialogueGame + ProofStandard",
        detail: "Dialogue games with varying burden of proof standards"
      },
    ]
  },
  {
    id: 'ludics',
    title: 'Ludics & Interactive Proof',
    description: 'Proof-as-interaction, designs, normalization, and convergence/divergence',
    color: 'amber',
    sources: [
      { 
        cite: "Girard (2001)", 
        title: "Locus Solum: From the Rules of Logic to the Logic of Rules",
        impl: "LudicDesign + LudicTrace + Normalization",
        detail: "Interactive logic: designs as proof strategies, normalization as dialogue"
      },
      { 
        cite: "Lecomte", 
        title: "Ludics, Dialogue and Inferentialism",
        impl: "InferentialSemantics + DesignInteraction",
        detail: "Inferentialist semantics grounded in ludics interaction"
      },
      { 
        cite: "Fouqueré & Quatrini", 
        title: "Inferences and Dialogues in Ludics",
        impl: "LudicInference + DialogueConvergence",
        detail: "Inference rules derived from interactive dialogue convergence"
      },
      { 
        cite: "Fouqueré", 
        title: "Argumentation and Inference: A Unified Approach",
        impl: "ArgumentInference + UnifiedFramework",
        detail: "Unification of argumentation theory with ludics inference model"
      },
      { 
        cite: "Boritchev", 
        title: "Dialogue Modeling in a Dynamic Framework",
        impl: "DynamicDialogue + ContextUpdate",
        detail: "Dynamic framework for dialogue with context-sensitive update"
      },
    ]
  },
  {
    id: 'discourse',
    title: 'Discourse Structure & Relations',
    description: 'Textual entailment, discourse relations, enthymemes, and relevance',
    color: 'emerald',
    sources: [
      { 
        cite: "Rocci", 
        title: "Diagramming the Enthymematic Structure of Counterarguments",
        impl: "EnthymemeReconstruction + ImplicitPremise",
        detail: "Methods for surfacing implicit premises in counterarguments"
      },
      { 
        cite: "Catta", 
        title: "Inferential Semantics as Argumentative Dialogues",
        impl: "InferentialRole + DialogicalSemantics",
        detail: "Meaning as inferential role expressed through dialogue"
      },
      { 
        cite: "Catta", 
        title: "Dialogical Argumentation and Textual Entailment",
        impl: "TextualEntailment + DialogicalInference",
        detail: "Mapping textual entailment to dialogical argumentation moves"
      },
      { 
        cite: "Lascarides & Asher", 
        title: "Discourse Relations and Defeasible Knowledge",
        impl: "DiscourseRelation + DefeasibleConnective",
        detail: "Defeasible logic for discourse coherence and relation interpretation"
      },
      { 
        cite: "Schaden", 
        title: "Relevance and Utility in an Argumentative Framework",
        impl: "RelevanceFilter + TopicAccommodation",
        detail: "Computational relevance for discourse topic management"
      },
      { 
        cite: "Kocurek", 
        title: "The Dynamics of Argumentative Discourse",
        impl: "DiscourseUpdate + ArgumentativeDynamic",
        detail: "Dynamic semantics for evolving argumentative contexts"
      },
    ]
  },
  {
    id: 'interchange',
    title: 'Argument Interchange Format (AIF)',
    description: 'Standardized representation, import/export, and interoperability',
    color: 'cyan',
    sources: [
      { 
        cite: "Reed et al.", 
        title: "The Argument Interchange Format (AIF) Specification",
        impl: "AIFNode + AIFEdge + I/S/L-nodes",
        detail: "Standard ontology for argument representation and exchange"
      },
      { 
        cite: "Reed et al.", 
        title: "AIF+: Dialogue in the Argument Interchange Format",
        impl: "AIFDialogue + TransitionScheme",
        detail: "Extended AIF with dialogue move representation"
      },
      { 
        cite: "Bex et al.", 
        title: "On Logical Specifications of the Argument Interchange Format",
        impl: "AIFLogic + FormalSemantics",
        detail: "Logical foundations and formal semantics for AIF"
      },
      { 
        cite: "Bentahar et al.", 
        title: "A Taxonomy of Argumentation Models",
        impl: "ModelTaxonomy + RepresentationMapping",
        detail: "Comprehensive taxonomy for comparing argumentation models"
      },
    ]
  },
  {
    id: 'visualization',
    title: 'Argument Mapping & Visualization',
    description: 'Graphical representation, debate structure, and knowledge organization',
    color: 'violet',
    sources: [
      { 
        cite: "Harrell", 
        title: "Representing the Structure of a Debate",
        impl: "DebateSheet + ArgumentGraph",
        detail: "Visual representation schemes for complex debate structure"
      },
      { 
        cite: "Murungi", 
        title: "Applying Argument Mapping to Facilitate Theory Building",
        impl: "TheoryMap + ConceptualStructure",
        detail: "Argument mapping as tool for theoretical knowledge construction"
      },
    ]
  },
  {
    id: 'platform',
    title: 'Platform Design & Epistemology',
    description: 'Online deliberation, collective intelligence, and epistemic health',
    color: 'pink',
    sources: [
      { 
        cite: "De Liddo et al.", 
        title: "Understanding Failures and Potentials of Argumentation Tools",
        impl: "ToolEvaluation + UserRequirements",
        detail: "Empirical analysis of argumentation tool adoption and effectiveness"
      },
      { 
        cite: "Amico-Korby", 
        title: "Building Epistemically Healthier Platforms",
        impl: "EpistemicHealth + PlatformDesign",
        detail: "Design principles for platforms that improve collective reasoning"
      },
      { 
        cite: "Amico-Korby", 
        title: "Do It Yourself Content and the Wisdom of the Crowds",
        impl: "CollectiveIntelligence + ContentCuration",
        detail: "User-generated content and collective knowledge aggregation"
      },
      { 
        cite: "Negarestani", 
        title: "Intelligence and Spirit",
        impl: "CollectiveRationality + SapientPlatform",
        detail: "Philosophical foundations for collective intelligence platforms"
      },
    ]
  },
];
