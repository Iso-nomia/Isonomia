// packages/ludics-engine/commitments.ts
import { prisma } from '@/lib/prismaclient';
import { Hooks } from './hooks';
import { parseRule, isNegation, stripNegation, validateRule } from './rule-parser';
import { canonicalizeClaimText } from '@/lib/ids/mintMoid';
import { bindParticipantToDesign, BindError } from '@/server/ludics/bindParticipantToDesign';

type AddOp = {
  label: string;
  basePolarity: 'pos'|'neg';
  baseLocusPath?: string;
  designIds?: string[];
  derived?: boolean;
  entitled?: boolean;          // NEW: allow setting on add
  /** Optional write-seam hook — when provided fires bind_participant_to_design after element creation. */
  witnessHook?: {
    dialogueMoveId: string;
    ludicMoveId: string;
    schemeKey?: string;
  };
};
type EraseOp = { byLabel?: string; byLocusPath?: string };

function norm(s?: string) { return String(s ?? '').trim(); }

/**
 * Get all ancestor paths for a given locus path.
 * E.g., "0.1.2" → ["0", "0.1", "0.1.2"]
 */
function getAncestorPaths(path: string): string[] {
  const parts = path.split('.');
  const paths: string[] = [];
  for (let i = 1; i <= parts.length; i++) {
    paths.push(parts.slice(0, i).join('.'));
  }
  return paths;
}

/**
 * Check if pathA is an ancestor of pathB (or equal).
 * E.g., "0.1" is ancestor of "0.1.2", "0" is ancestor of "0.1"
 */
function isAncestorOrEqual(ancestorPath: string, descendantPath: string): boolean {
  if (ancestorPath === descendantPath) return true;
  return descendantPath.startsWith(ancestorPath + '.');
}

async function ensureRoot(dialogueId: string) {
  let root = await prisma.ludicLocus.findFirst({ where: { dialogueId, path: '0' } });
  if (!root) root = await prisma.ludicLocus.create({ data: { dialogueId, path: '0' } });
  return root;
}

async function ensureLocus(dialogueId: string, path: string) {
  const parts = path.split('.').filter(Boolean);
  let parentPath = '';
  for (let i = 0; i < parts.length; i++) {
    const p = (parentPath ? parentPath + '.' : '') + parts[i];
    let hit = await prisma.ludicLocus.findFirst({ where: { dialogueId, path: p } });
    if (!hit) {
      hit = await prisma.ludicLocus.create({
        data: {
          dialogueId,
          path: p,
          parentId: i === 0 ? undefined : (await prisma.ludicLocus.findFirst({ where: { dialogueId, path: parentPath } }))?.id,
        },
      });
    }
    parentPath = p;
  }
  const final = await prisma.ludicLocus.findFirst({ where: { dialogueId, path } });
  if (!final) throw new Error('LOCUS_CREATE_FAILED');
  return final;
}

export async function applyToCS(
  dialogueId: string,
  ownerId: string,
  ops: { add?: AddOp[]; erase?: EraseOp[] }
) {
  await ensureRoot(dialogueId);
  let cs = await prisma.ludicCommitmentState.findFirst({ where: { ownerId } });
  if (!cs) {
    cs = await prisma.ludicCommitmentState.create({ data: { ownerId } });
  } else {
    await prisma.ludicCommitmentState.update({
      where: { id: cs.id },
      data: { updatedAt: new Date() },
    });
  }

  const added: string[] = [];
  const erased: string[] = [];

  if (ops.erase?.length) {
    for (const e of ops.erase) {
      const where: any = { ownerId };
      if (e.byLabel) where.label = e.byLabel;
      if (e.byLocusPath) {
        const base = await prisma.ludicLocus.findFirst({ where: { dialogueId, path: e.byLocusPath } });
        if (base) where.baseLocusId = base.id;
      }
      const victims = await prisma.ludicCommitmentElement.findMany({ where, select: { id: true } });
      if (victims.length) {
        const ids = victims.map(v => v.id);
        await prisma.ludicCommitmentElement.deleteMany({ where: { id: { in: ids } } });
        erased.push(...ids);
      }
    }
  }

  if (ops.add?.length) {
    for (const a of ops.add) {
      // Validate rule syntax if this is a rule (neg polarity)
      if (a.basePolarity === 'neg') {
        const validationError = validateRule(a.label);
        if (validationError) {
          throw new Error(`Invalid rule syntax: "${a.label}". ${validationError}`);
        }
      }
      
      const base = await ensureLocus(dialogueId, a.baseLocusPath ?? '0');
      const exists = await prisma.ludicCommitmentElement.findFirst({
        where: { ownerId, basePolarity: a.basePolarity, baseLocusId: base.id, label: a.label },
      });
      if (exists) { added.push(exists.id); continue; }
      const ce = await prisma.ludicCommitmentElement.create({
        data: {
          ownerId,
          basePolarity: a.basePolarity,
          baseLocusId: base.id,
          label: a.label,
          entitled: a.entitled ?? true,             // NEW
          ludicCommitmentStateId: cs.id,
          extJson: { derived: !!a.derived, designIds: a.designIds ?? [] },
        },
      });
      added.push(ce.id);

      // Write-seam hook: create WitnessRecord if caller provided binding context
      if (a.witnessHook) {
        try {
          await bindParticipantToDesign({
            dialogueMoveId: a.witnessHook.dialogueMoveId,
            ludicMoveId: a.witnessHook.ludicMoveId,
            participantId: ownerId,
            canonicalText: canonicalizeClaimText(a.label),
            schemeKey: a.witnessHook.schemeKey,
          });
        } catch (err) {
          if (err instanceof BindError) {
            // Degrade gracefully — CS update succeeded; log the witness failure
            console.warn(`[applyToCS] bind_participant_to_design skipped for element ${ce.id}: ${err.code} — ${err.message}`);
          } else {
            throw err;
          }
        }
      }
    }
  }

  Hooks.emitCSUpdated({ ownerId, csId: cs.id, added, erased });
  return { ok: true, csId: cs.id, added, erased };
}

 export async function listCS(dialogueId: string, ownerId: string) {
     // Dialog-scoped read: pull rows directly from elements
     const rows = await prisma.ludicCommitmentElement.findMany({
       where: { ownerId, baseLocus: { dialogueId } },
       include: { baseLocus: true },
     });
     if (!rows.length) return { ok: true, facts: [], rules: [] };
   
     const facts = rows
       .filter((e) => e.basePolarity === 'pos')
       .map((e) => ({
         label: e.label ?? '',
         entitled: e.entitled !== false,
         derived: !!(e.extJson as any)?.derived,
         locusPath: e.baseLocus?.path ?? '0',
       }));
   
     const rules = rows
       .filter((e) => e.basePolarity === 'neg')
       .map((e) => ({ label: e.label ?? '', locusPath: e.baseLocus?.path ?? '0' }));
   
     return { ok: true, facts, rules };
   }

export async function interactCE(dialogueId: string, ownerId: string) {
  // load entitled elements only
  const cs = await prisma.ludicCommitmentState.findFirst({
    where: { ownerId },
    include: { elements: true },
  });
  if (!cs) return { ok: true, csId: null, derivedFacts: [], contradictions: [] };

  const factRows = cs.elements.filter(e => e.basePolarity === 'pos' && e.entitled !== false);
  const ruleRows = cs.elements.filter(e => e.basePolarity === 'neg' && e.entitled !== false);

  const facts = new Set(factRows.map((e) => norm(e.label ?? '')).filter(Boolean));

  // allow "not X" style in facts
  const positives = new Set<string>();
  const negatives = new Set<string>();
  for (const f of facts) isNegation(f) ? negatives.add(stripNegation(f)) : positives.add(f);

  const rules = ruleRows
    .map(e => parseRule(e.label ?? ''))
    .filter(Boolean) as { ifAll: string[]; then: string }[];

  // forward-chaining saturation (very small)
  const derived = new Set<string>();
  let changed = true;
  const MAX_ITERS = 1024;
  let guard = 0;

  while (changed && guard++ < MAX_ITERS) {
    changed = false;
    for (const r of rules) {
      const ok = r.ifAll.every(p =>
        isNegation(p) ? negatives.has(stripNegation(p)) : positives.has(p)
      );
      if (!ok) continue;

      const head = r.then;
      if (isNegation(head)) {
        const h = stripNegation(head);
        if (!negatives.has(h)) { negatives.add(h); derived.add(`not ${h}`); changed = true; }
      } else {
        if (!positives.has(head)) { positives.add(head); derived.add(head); changed = true; }
      }
    }
  }

  // contradictions: X and not X
  const contradictions: { a: string; b: string }[] = [];
  for (const x of positives) {
    if (negatives.has(x)) contradictions.push({ a: x, b: `not ${x}` });
  }

  const derivedFacts = Array.from(derived)
    .filter(lbl => !facts.has(lbl))
    .map(label => ({ label }));

  return { ok: true, csId: cs.id, derivedFacts, contradictions };
}

export async function setEntitlement(ownerId: string, label: string, entitled: boolean) {
  await prisma.ludicCommitmentElement.updateMany({
    where: { ownerId, label },
    data: { entitled },
  });
  return { ok:true };
}

/**
 * Get effective facts and rules at a specific locus, including inherited from ancestors.
 * This is the core of scoped inference - child loci inherit parent commitments.
 */
export async function getEffectiveCommitments(
  dialogueId: string,
  ownerId: string,
  locusPath: string = '0'
): Promise<{
  facts: Array<{ label: string; entitled: boolean; derived: boolean; locusPath: string; inherited: boolean }>;
  rules: Array<{ label: string; locusPath: string; inherited: boolean }>;
}> {
  // Get all ancestor paths (including self)
  const ancestorPaths = getAncestorPaths(locusPath);
  
  // Fetch all loci for these paths
  const loci = await prisma.ludicLocus.findMany({
    where: { dialogueId, path: { in: ancestorPaths } },
    select: { id: true, path: true },
  });
  
  const locusIds = loci.map(l => l.id);
  const pathById = new Map(loci.map(l => [l.id, l.path]));
  
  // Fetch all commitment elements at these loci
  const elements = await prisma.ludicCommitmentElement.findMany({
    where: {
      ownerId,
      baseLocusId: { in: locusIds },
      entitled: { not: false },
    },
    include: { baseLocus: true },
  });
  
  const facts = elements
    .filter(e => e.basePolarity === 'pos')
    .map(e => ({
      label: e.label ?? '',
      entitled: e.entitled !== false,
      derived: !!(e.extJson as any)?.derived,
      locusPath: e.baseLocus?.path ?? '0',
      inherited: e.baseLocus?.path !== locusPath, // Mark if inherited from ancestor
    }));
  
  const rules = elements
    .filter(e => e.basePolarity === 'neg')
    .map(e => ({
      label: e.label ?? '',
      locusPath: e.baseLocus?.path ?? '0',
      inherited: e.baseLocus?.path !== locusPath,
    }));
  
  return { facts, rules };
}

/**
 * Scoped inference at a specific locus.
 * Inherits facts and rules from parent loci, runs forward-chaining,
 * and detects contradictions (including inherited vs local conflicts).
 */
export async function interactCEScoped(
  dialogueId: string,
  ownerId: string,
  locusPath: string = '0'
): Promise<{
  ok: boolean;
  locusPath: string;
  derivedFacts: Array<{ label: string; derivedAt: string }>;
  contradictions: Array<{ a: string; b: string; aLocusPath: string; bLocusPath: string; type: 'local' | 'inherited' }>;
  effectiveFacts: Array<{ label: string; locusPath: string; inherited: boolean }>;
  effectiveRules: Array<{ label: string; locusPath: string; inherited: boolean }>;
}> {
  const { facts, rules } = await getEffectiveCommitments(dialogueId, ownerId, locusPath);
  
  // Build fact sets with locus tracking
  const factsByLabel = new Map<string, { locusPath: string; inherited: boolean }>();
  const positives = new Set<string>();
  const negatives = new Set<string>();
  
  for (const f of facts) {
    const label = norm(f.label);
    if (!label) continue;
    
    // Track where each fact came from
    if (!factsByLabel.has(label)) {
      factsByLabel.set(label, { locusPath: f.locusPath, inherited: f.inherited });
    }
    
    if (isNegation(label)) {
      negatives.add(stripNegation(label));
    } else {
      positives.add(label);
    }
  }
  
  // Parse rules
  const parsedRules = rules
    .map(r => ({ ...parseRule(r.label ?? ''), locusPath: r.locusPath, inherited: r.inherited }))
    .filter(r => r && r.ifAll) as Array<{ ifAll: string[]; then: string; locusPath: string; inherited: boolean }>;
  
  // Forward-chaining inference
  const derived = new Map<string, string>(); // label → derived at locusPath
  let changed = true;
  const MAX_ITERS = 1024;
  let guard = 0;
  
  while (changed && guard++ < MAX_ITERS) {
    changed = false;
    for (const r of parsedRules) {
      const ok = r.ifAll.every(p =>
        isNegation(p) ? negatives.has(stripNegation(p)) : positives.has(p)
      );
      if (!ok) continue;
      
      const head = r.then;
      if (isNegation(head)) {
        const h = stripNegation(head);
        if (!negatives.has(h)) {
          negatives.add(h);
          derived.set(`not ${h}`, r.locusPath);
          changed = true;
        }
      } else {
        if (!positives.has(head)) {
          positives.add(head);
          derived.set(head, r.locusPath);
          changed = true;
        }
      }
    }
  }
  
  // Detect contradictions with locus tracking
  const contradictions: Array<{
    a: string;
    b: string;
    aLocusPath: string;
    bLocusPath: string;
    type: 'local' | 'inherited';
  }> = [];
  
  for (const x of positives) {
    if (negatives.has(x)) {
      // Find where positive and negative came from
      const posSource = factsByLabel.get(x) ?? derived.has(x) 
        ? { locusPath: derived.get(x) ?? locusPath, inherited: false }
        : { locusPath, inherited: false };
      const negSource = factsByLabel.get(`not ${x}`) ?? derived.has(`not ${x}`)
        ? { locusPath: derived.get(`not ${x}`) ?? locusPath, inherited: false }
        : { locusPath, inherited: false };
      
      // Determine if contradiction involves inherited facts
      const isInherited = posSource.locusPath !== locusPath || negSource.locusPath !== locusPath;
      
      contradictions.push({
        a: x,
        b: `not ${x}`,
        aLocusPath: typeof posSource === 'object' ? posSource.locusPath : locusPath,
        bLocusPath: typeof negSource === 'object' ? negSource.locusPath : locusPath,
        type: isInherited ? 'inherited' : 'local',
      });
    }
  }
  
  // Build derived facts list (excluding original facts)
  const originalLabels = new Set(facts.map(f => norm(f.label)));
  const derivedFacts = Array.from(derived.entries())
    .filter(([label]) => !originalLabels.has(label))
    .map(([label, derivedAt]) => ({ label, derivedAt }));
  
  // Effective facts = original + derived
  const effectiveFacts = [
    ...facts.map(f => ({ label: f.label, locusPath: f.locusPath, inherited: f.inherited })),
    ...derivedFacts.map(d => ({ label: d.label, locusPath: d.derivedAt, inherited: false })),
  ];
  
  return {
    ok: true,
    locusPath,
    derivedFacts,
    contradictions,
    effectiveFacts,
    effectiveRules: rules,
  };
}

/**
 * Check for semantic divergence between two owners at a locus.
 * Returns divergent if they have contradictory commitments.
 */
export async function checkSemanticDivergence(
  dialogueId: string,
  ownerA: string,
  ownerB: string,
  locusPath: string = '0'
): Promise<{
  ok: boolean;
  divergent: boolean;
  conflicts: Array<{
    proposition: string;
    ownerAPosition: 'asserts' | 'denies';
    ownerBPosition: 'asserts' | 'denies';
    locusPath: string;
  }>;
}> {
  const [resultA, resultB] = await Promise.all([
    interactCEScoped(dialogueId, ownerA, locusPath),
    interactCEScoped(dialogueId, ownerB, locusPath),
  ]);
  
  // Build fact sets for each owner
  const factsA = new Set<string>();
  const negsA = new Set<string>();
  for (const f of resultA.effectiveFacts) {
    const label = norm(f.label);
    if (isNegation(label)) {
      negsA.add(stripNegation(label));
    } else {
      factsA.add(label);
    }
  }
  
  const factsB = new Set<string>();
  const negsB = new Set<string>();
  for (const f of resultB.effectiveFacts) {
    const label = norm(f.label);
    if (isNegation(label)) {
      negsB.add(stripNegation(label));
    } else {
      factsB.add(label);
    }
  }
  
  // Find contradictions: A asserts X, B denies X (or vice versa)
  const conflicts: Array<{
    proposition: string;
    ownerAPosition: 'asserts' | 'denies';
    ownerBPosition: 'asserts' | 'denies';
    locusPath: string;
  }> = [];
  
  // A asserts X, B denies X
  for (const x of factsA) {
    if (negsB.has(x)) {
      conflicts.push({
        proposition: x,
        ownerAPosition: 'asserts',
        ownerBPosition: 'denies',
        locusPath,
      });
    }
  }
  
  // A denies X, B asserts X
  for (const x of negsA) {
    if (factsB.has(x)) {
      conflicts.push({
        proposition: x,
        ownerAPosition: 'denies',
        ownerBPosition: 'asserts',
        locusPath,
      });
    }
  }
  
  return {
    ok: true,
    divergent: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Run inference at all loci in a dialogue and detect divergence points.
 * Returns a map of locus paths to their inference results.
 */
export async function analyzeDialogueInference(
  dialogueId: string,
  ownerA: string,
  ownerB: string
): Promise<{
  ok: boolean;
  lociAnalysis: Array<{
    locusPath: string;
    ownerA: { factCount: number; ruleCount: number; derivedCount: number; contradictions: number };
    ownerB: { factCount: number; ruleCount: number; derivedCount: number; contradictions: number };
    semanticDivergence: boolean;
    conflicts: Array<{ proposition: string; ownerAPosition: string; ownerBPosition: string }>;
  }>;
}> {
  // Get all loci for this dialogue
  const loci = await prisma.ludicLocus.findMany({
    where: { dialogueId },
    select: { path: true },
    orderBy: { path: 'asc' },
  });
  
  const lociAnalysis = [];
  
  for (const locus of loci) {
    const [resultA, resultB, divergence] = await Promise.all([
      interactCEScoped(dialogueId, ownerA, locus.path),
      interactCEScoped(dialogueId, ownerB, locus.path),
      checkSemanticDivergence(dialogueId, ownerA, ownerB, locus.path),
    ]);
    
    lociAnalysis.push({
      locusPath: locus.path,
      ownerA: {
        factCount: resultA.effectiveFacts.length,
        ruleCount: resultA.effectiveRules.length,
        derivedCount: resultA.derivedFacts.length,
        contradictions: resultA.contradictions.length,
      },
      ownerB: {
        factCount: resultB.effectiveFacts.length,
        ruleCount: resultB.effectiveRules.length,
        derivedCount: resultB.derivedFacts.length,
        contradictions: resultB.contradictions.length,
      },
      semanticDivergence: divergence.divergent,
      conflicts: divergence.conflicts.map(c => ({
        proposition: c.proposition,
        ownerAPosition: c.ownerAPosition,
        ownerBPosition: c.ownerBPosition,
      })),
    });
  }
  
  return { ok: true, lociAnalysis };
}
