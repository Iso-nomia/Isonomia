//scripts/schemes.seed.ts
import { PrismaClient, AttackType, TargetScope } from "@prisma/client";
const prisma = new PrismaClient();

type CQSeed = {
  cqKey: string;
  text: string;
  attackType: AttackType;
  targetScope: TargetScope;
  // NEW: ASPIC+ formalization for CQs
  aspicMapping?: {
    ruleId?: string;        // For UNDERCUTS (which rule this attacks)
    premiseIndex?: number;  // For UNDERMINES (which premise index)
    defeasibleRuleRequired?: boolean; // True if target must be defeasible
  };
};

type SchemeSeed = {
  key: string;
  name: string;
  description?: string;
  purpose: "action" | "state_of_affairs";
  source: "internal" | "external";
  materialRelation: string;
  reasoningType: "deductive" | "inductive" | "abductive" | "practical";
  ruleForm: string;
  conclusionType?: string | null;
  slotHints?: any;
  cqs: CQSeed[];
  // NEW: ASPIC+ formalization for scheme
  aspicMapping?: {
    ruleType: "strict" | "defeasible";  // How this scheme translates to ASPIC+ rules
    ruleId?: string;                     // Optional rule identifier
    preferenceLevel?: number;            // Default preference level (1-10, higher = stronger)
  };
};

const SEEDS: SchemeSeed[] = [
  {
    key: "expert_opinion",
    name: "Argument from Expert Opinion",
    purpose: "state_of_affairs",
    source: "external",
    materialRelation: "authority",
    reasoningType: "abductive",
    ruleForm: "defeasible_MP",
    conclusionType: "is",
    slotHints: {
      premises: [
        { role: "E", label: "Expert (entity)" },
        { role: "D", label: "Domain" },
        { role: "φ", label: "Statement asserted" },
        { role: "cred", label: "Credibility (optional)" },
      ],
    },
    cqs: [
      { cqKey: "domain_fit", text: "Is E an expert in D?", attackType: "UNDERCUTS", targetScope: "inference" },
      { cqKey: "consensus",  text: "Do experts in D disagree on φ?", attackType: "UNDERCUTS", targetScope: "inference" },
      { cqKey: "bias",       text: "Is E biased?", attackType: "UNDERCUTS", targetScope: "inference" },
      { cqKey: "basis",      text: "Is E’s assertion based on evidence?", attackType: "UNDERMINES", targetScope: "premise" },
    ],
  },
  // NOTE (2026-06-12): the practical-reasoning family — `practical_reasoning`,
  // `positive_consequences`, `negative_consequences` (plus `value_based_pr` and
  // `slippery_slope`) — is owned by `scripts/seed.practical-reasoning.ts`, which
  // carries the canonical Walton CQ sets (PR.*, PC.*, NC.*) and slot hints.
  // Those entries were removed from this script to make that the single source of
  // truth: both scripts upsert CQs by (schemeId, cqKey) without deleting stale
  // rows, so duplicate entries with *different* cqKeys would accumulate (e.g. PR
  // would end up with 3 thin + 6 canonical = 9 CQs). See
  // RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/11b-practical-reasoning-enhancements-2026-06-12.md (item 1).
  {
    key: "analogy",
    name: "Argument from Analogy",
    purpose: "state_of_affairs",
    source: "internal",
    materialRelation: "analogy",
    reasoningType: "abductive",
    ruleForm: "defeasible_MP",
    cqs: [
      { cqKey: "relevant_sims", text: "Are the relevant similarities strong?", attackType: "UNDERCUTS", targetScope: "inference" },
      { cqKey: "critical_diffs", text: "Are there critical differences?", attackType: "UNDERCUTS", targetScope: "inference" },
    ],
  },
  {
    key: "causal",
    name: "Causal (If cause then effect)",
    purpose: "state_of_affairs",
    source: "internal",
    materialRelation: "cause",
    reasoningType: "inductive",
    ruleForm: "defeasible_MP",
    cqs: [
      { cqKey: "alt_causes", text: "Could another cause explain the effect?", attackType: "UNDERCUTS", targetScope: "inference" },
      { cqKey: "post_hoc",   text: "Is this merely correlation (post hoc)?", attackType: "UNDERCUTS", targetScope: "inference" },
    ],
  },
  {
    key: "classification",
    name: "Classification/Definition",
    purpose: "state_of_affairs",
    source: "internal",
    materialRelation: "definition",
    reasoningType: "deductive",
    ruleForm: "MP",
    cqs: [
      { cqKey: "category_fit", text: "Does the case fit the category?", attackType: "UNDERCUTS", targetScope: "inference" },
    ],
  },
];

async function main() {
  for (const s of SEEDS) {
    const scheme = await prisma.argumentScheme.upsert({
      where: { key: s.key },
      update: {
        name: s.name,
        description: s.description ?? null,
        summary: s.description ?? "", // Add summary, fallback to description or empty string
        purpose: s.purpose,
        source: s.source,
        materialRelation: s.materialRelation,
        reasoningType: s.reasoningType,
        ruleForm: s.ruleForm,
        conclusionType: s.conclusionType ?? null,
        slotHints: s.slotHints ?? {},
        aspicMapping: s.aspicMapping ?? null, // NEW: ASPIC+ mapping
      },
      create: {
        key: s.key,
        name: s.name,
        description: s.description ?? null,
        summary: s.description ?? "", // Add summary, fallback to description or empty string
        purpose: s.purpose,
        source: s.source,
        materialRelation: s.materialRelation,
        reasoningType: s.reasoningType,
        ruleForm: s.ruleForm,
        conclusionType: s.conclusionType ?? null,
        slotHints: s.slotHints ?? {},
        aspicMapping: s.aspicMapping ?? null, // NEW: ASPIC+ mapping
      },
    });

    for (const cq of s.cqs) {
      await prisma.criticalQuestion.upsert({
        where: { schemeId_cqKey: { schemeId: scheme.id, cqKey: cq.cqKey } },
        update: {
          text: cq.text,
          attackType: cq.attackType,
          targetScope: cq.targetScope,
          aspicMapping: cq.aspicMapping ?? null, // NEW: ASPIC+ mapping
        },
        create: {
          schemeId: scheme.id,
          cqKey: cq.cqKey,
          text: cq.text,
          attackType: cq.attackType,
          targetScope: cq.targetScope,
          attackKind: cq.attackType, // Ensure this maps correctly
          status: "OPEN", // Default status for template CQs
          aspicMapping: cq.aspicMapping ?? null, // NEW: ASPIC+ mapping
        },
      });
    }
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
