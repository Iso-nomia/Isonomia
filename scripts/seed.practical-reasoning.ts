// scripts/seed.practical-reasoning.ts
/* tslint:disable no-console */
import { PrismaClient, AttackType, TargetScope } from '@prisma/client';
import { CriticalQuestion } from '@prisma/client';
import { premiseTypeFor } from '../lib/schemes/practical-premise-types';
const prisma = new PrismaClient();

type CqDef = {
  cqKey: string;
  text: string;
  attackType: AttackType;
  targetScope: TargetScope;
};

type SchemeDef = {
  key: string;
  name: string;
  summary: string;
  purpose: string;            // Macagno taxonomy facets your UI needs
  source: string;
  materialRelation: string;
  reasoningType: string;
  ruleForm?: string | null;
  conclusionType?: string | null;
  slotHints?: any;
  cqs: CqDef[];
};

// --- Catalog (4 schemes) ---
const CATALOG: SchemeDef[] = [
  {
    key: 'practical_reasoning',
    name: 'Practical Reasoning (Goal–Means–Ought)',
    summary: 'From a goal/value and a means, infer that one ought to act.',
    purpose: 'action',
    source: 'internal',
    materialRelation: 'practical',
    reasoningType: 'practical',
    ruleForm: 'defeasible_MP',
    conclusionType: 'ought',
    slotHints: {
      premises: [
        { role: 'goal', label: 'Goal G (desired value)' },
        { role: 'means', label: 'Action A achieves G' },
        { role: 'context', label: 'Contextual assumptions (if any)' },
      ],
    },
    cqs: [
      { cqKey: 'PR.GOAL_ACCEPTED', text: 'Is the goal/value G explicit and acceptable?', attackType: AttackType.UNDERMINES, targetScope: TargetScope.premise },
      { cqKey: 'PR.MEANS_EFFECTIVE', text: 'Will doing A actually achieve G in the present context?', attackType: AttackType.UNDERCUTS, targetScope: TargetScope.inference },
      { cqKey: 'PR.ALTERNATIVES', text: 'Is there a better alternative than A to achieve G?', attackType: AttackType.REBUTS, targetScope: TargetScope.conclusion },
      { cqKey: 'PR.SIDE_EFFECTS', text: 'Do negative consequences of A outweigh achieving G?', attackType: AttackType.REBUTS, targetScope: TargetScope.conclusion },
      { cqKey: 'PR.FEASIBILITY', text: 'Is A feasible for the agent (ability, resources, time)?', attackType: AttackType.UNDERMINES, targetScope: TargetScope.premise },
      { cqKey: 'PR.PERMISSIBILITY', text: 'Is doing A permissible/appropriate given norms or constraints?', attackType: AttackType.REBUTS, targetScope: TargetScope.conclusion },
    ],
  },

  {
    key: 'positive_consequences',
    name: 'Argument from Positive Consequences',
    summary: 'Acting A is recommended because it leads to good outcomes.',
    purpose: 'action',
    source: 'external',
    materialRelation: 'cause',
    reasoningType: 'defeasible',
    slotHints: {
      premises: [
        { role: 'consequence', label: 'Likely good consequence C of A' },
        { role: 'link', label: 'A tends to cause C' },
      ],
    },
    cqs: [
      { cqKey: 'PC.LIKELIHOOD', text: 'Are the stated good consequences likely to occur?', attackType: AttackType.UNDERCUTS, targetScope: TargetScope.inference },
      { cqKey: 'PC.SIGNIFICANCE', text: 'Are the good consequences significant enough to justify A?', attackType: AttackType.REBUTS, targetScope: TargetScope.conclusion },
      { cqKey: 'PC.NEG_SIDE', text: 'Are there overlooked negative side‑effects outweighing the good?', attackType: AttackType.REBUTS, targetScope: TargetScope.conclusion },
    ],
  },

  {
    key: 'negative_consequences',
    name: 'Argument from Negative Consequences',
    summary: 'Acting A is discouraged because it leads to bad outcomes.',
    purpose: 'action',
    source: 'external',
    materialRelation: 'cause',
    reasoningType: 'defeasible',
    slotHints: {
      premises: [
        { role: 'consequence', label: 'Likely bad consequence ¬C of A' },
        { role: 'link', label: 'A tends to cause ¬C' },
      ],
    },
    cqs: [
      { cqKey: 'NC.LIKELIHOOD', text: 'Are the stated bad consequences likely to occur?', attackType: AttackType.UNDERCUTS, targetScope: TargetScope.inference },
      { cqKey: 'NC.MITIGATION', text: 'Can the bad effects be mitigated so they are acceptable?', attackType: AttackType.REBUTS, targetScope: TargetScope.conclusion },
      { cqKey: 'NC.TRADEOFFS', text: 'Are there benefits that outweigh the bad effects?', attackType: AttackType.REBUTS, targetScope: TargetScope.conclusion },
    ],
  },

  {
    key: 'value_based_pr',
    name: 'Value‑based Practical Reasoning',
    summary: 'Action A is recommended because it promotes value V.',
    purpose: 'action',
    source: 'internal',
    materialRelation: 'value',
    reasoningType: 'practical',
    slotHints: {
      premises: [
        { role: 'value', label: 'Relevant value V' },
        { role: 'promotion', label: 'A promotes V (in this context)' },
      ],
    },
    cqs: [
      { cqKey: 'VB.RELEVANCE', text: 'Is value V applicable in this context?', attackType: AttackType.UNDERMINES, targetScope: TargetScope.premise },
      { cqKey: 'VB.PROMOTES', text: 'Does doing A really promote V here?', attackType: AttackType.UNDERCUTS, targetScope: TargetScope.inference },
      { cqKey: 'VB.CONFLICT', text: 'Is there a conflicting/weightier value overriding V?', attackType: AttackType.REBUTS, targetScope: TargetScope.conclusion },
    ],
  },

  {
    key: 'slippery_slope',
    name: 'Slippery Slope',
    summary: 'Doing A will (likely) lead down a chain to unacceptable C; therefore avoid A.',
    purpose: 'action',
    source: 'external',
    materialRelation: 'cause',
    reasoningType: 'inductive',
    slotHints: {
      premises: [
        { role: 'start', label: 'Initial step A' },
        { role: 'chain', label: 'A → B → … → C (drift/pressure)' },
        { role: 'endpoint', label: 'Unacceptable endpoint C' },
      ],
    },
    cqs: [
      { cqKey: 'SS.CHAIN_PLAUSIBLE', text: 'Is the causal/probabilistic chain from A to C plausible?', attackType: AttackType.UNDERCUTS, targetScope: TargetScope.inference },
      { cqKey: 'SS.STOPPING_POINTS', text: 'Are there realistic stopping points or safeguards?', attackType: AttackType.UNDERCUTS, targetScope: TargetScope.inference },
      { cqKey: 'SS.PROBABILITY', text: 'How probable/typical is the slide under normal governance?', attackType: AttackType.UNDERCUTS, targetScope: TargetScope.inference },
      { cqKey: 'SS.ENDPOINT_BAD', text: 'Is the endpoint C truly unacceptable (all things considered)?', attackType: AttackType.REBUTS, targetScope: TargetScope.conclusion },
    ],
  },
];

async function upsertScheme(def: SchemeDef) {
  const scheme = await prisma.argumentScheme.upsert({
    where: { key: def.key },
    create: {
      key: def.key,
      name: def.name,
      summary: def.summary,
      purpose: def.purpose,
      source: def.source,
      materialRelation: def.materialRelation,
      reasoningType: def.reasoningType,
      ruleForm: def.ruleForm ?? null,
      conclusionType: def.conclusionType ?? null,
      slotHints: def.slotHints ?? null,
      cq: def.cqs.map(({ cqKey, text }) => ({ cqKey, text })),
    },
    update: {
      name: def.name,
      summary: def.summary,
      purpose: def.purpose,
      source: def.source,
      materialRelation: def.materialRelation,
      reasoningType: def.reasoningType,
      ruleForm: def.ruleForm ?? null,
      conclusionType: def.conclusionType ?? null,
      slotHints: def.slotHints ?? null,
      cq: def.cqs.map(({ cqKey, text }) => ({ cqKey, text })),
    },
  });

  // Ensure CriticalQuestion rows (unique per (schemeId, cqKey))
  for (const cq of def.cqs) {
    // Item 4: Carneades premiseType (open-by-default ASSUMPTION CQs auto-waive).
    // Only set when there is a deliberate mapping; unmapped CQs stay as-is
    // (ORDINARY default per Walton 2008 §11.1).
    const premiseType = premiseTypeFor(def.key, cq.cqKey);
    await prisma.criticalQuestion.upsert({
      // This requires @@unique([schemeId, cqKey]) in your schema (already present)
      where: { schemeId_cqKey: { schemeId: scheme.id, cqKey: cq.cqKey } },
      update: {
        text: cq.text,
        // attackKind is a STRING column in your model:
        attackKind: String(cq.attackType),
        // keep the typed fields for automation/mapping:
        attackType: cq.attackType,
        targetScope: cq.targetScope,
        status: 'open',
        ...(premiseType ? { premiseType } : {}),
      },
      create: {
        // Use the relation form → lands on CreateInput (no Unchecked noise)
        scheme: { connect: { id: scheme.id } },
        cqKey: cq.cqKey,
        text: cq.text,
        attackKind: String(cq.attackType),
        attackType: cq.attackType,
        targetScope: cq.targetScope,
        status: 'open',
        openedById: 'seed', // optional, but nice for provenance
        ...(premiseType ? { premiseType } : {}),
      },
    });
  }

  return scheme.key;
}

// model CriticalQuestion {
//   id           String          @id @default(cuid())
//   instanceId   String?
//   schemeId     String?
//   scheme       ArgumentScheme? @relation(fields: [schemeId], references: [id], onDelete: Cascade)
//   cqKey        String?
//   cqId         String?
//   text         String
//   attackKind   String // 'UNDERMINES'|'UNDERCUTS'|'REBUTS'
//   status       String // 'open'|'addressed'|'counter-posted'
//   openedById   String?
//   resolvedById String?
//   createdAt    DateTime        @default(now())
//   // for automation: how the CQ maps to an attack
//   attackType   AttackType? // REBUTS | UNDERCUTS | UNDERMINES
//   targetScope  TargetScope? // conclusion | inference | premise
//   instance     SchemeInstance? @relation(fields: [instanceId], references: [id], onDelete: Cascade)

//   @@unique([schemeId, cqKey])
//   @@index([instanceId])
// }

(async () => {
  try {
    const seeded = [];
    for (const def of CATALOG) seeded.push(await upsertScheme(def));
    console.log('Seeded schemes:', seeded.join(', '));
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
