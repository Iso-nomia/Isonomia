// lib/arguments/diagram.ts
import { prisma } from "../prismaclient";

export type Diagram = {
  id: string;
  title?: string | null;
  statements: Array<{ id: string; text: string; kind: 'claim'|'premise'|'warrant'|'backing'|'rebuttal'|'statement' }>;
  inferences: Array<{
    id: string;
    kind?: string | null;
    conclusion: { id: string; text: string };
    premises: Array<{ statement: { id: string; text: string } }>;
    scheme?: string | null;
  }>;
  evidence: Array<{ id: string; uri: string; note?: string | null }>;
  // AIF-true view of the same neighbourhood
  aif?: AifSubgraph;
};

// ---------- AIF nodes/edges ----------
export type AifNodeKind = 'I'|'RA'|'CA'|'PA';
export type AifEdgeRole =
  | 'premise' | 'conclusion'
  | 'conflictingElement' | 'conflictedElement'
  | 'preferredElement'  | 'dispreferredElement'
  | 'has-presumption' | 'has-exception';
export type AifNode = {
  id: string;                // e.g., "I:claimId", "RA:argId", "CA:caId", "PA:paId"
  kind: AifNodeKind;
  label?: string | null;     // human label (claim text, "RA a123…", etc.)
  schemeKey?: string | null; // optional: scheme typing for RA/CA/PA (if available)
  
  // Phase 2.4: Enhanced metadata (Debate Layer Modernization)
  schemeName?: string | null;        // Human-readable scheme name
  cqStatus?: {                        // Critical question status
    total: number;
    answered: number;
    open: number;
    keys: string[];
  } | null;
  dialogueMoveId?: string | null;    // Which move created this argument
  locutionType?: string | null;      // ASSERT | WHY | RETRACT | etc.
  isImported?: boolean;              // Was this imported cross-delib?
  importedFrom?: string[] | null;    // Source deliberation IDs
  toulminDepth?: number | null;      // Max inference chain depth (for RA-nodes)
};

export type AifEdge = { 
  id: string; 
  from: string; 
  to: string; 
  role: AifEdgeRole;
};

export type AifSubgraph = { 
  nodes: AifNode[]; 
  edges: AifEdge[];
};

// Small helpers
const I = (claimId: string) => `I:${claimId}`;
const RA = (argId: string)   => `RA:${argId}`;
const CA = (caId: string)    => `CA:${caId}`;
const PA = (paId: string)    => `PA:${paId}`;

/** Build a local AIF subgraph centered on the given RA (argument). */
export async function buildAifSubgraphForArgument(argumentId: string): Promise<AifSubgraph|null> {
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      id: true, text: true, schemeId: true,
      conclusionClaimId: true,
      premises: { select: { claimId: true, isImplicit: true } },
      deliberationId: true
    }
  });
  if (!arg) return null;

  const claimIds = Array.from(new Set([
    ...(arg.conclusionClaimId ? [arg.conclusionClaimId] : []),
    ...arg.premises.map(p => p.claimId),
  ]));
  const claims = claimIds.length
    ? await prisma.claim.findMany({ where: { id: { in: claimIds } }, select: { id: true, text: true } })
    : [];
  const labelOf = new Map(claims.map(c => [c.id, c.text || c.id]));

// /// Tag a (possibly implicit) assumption that an argument a relies upon.
// model AssumptionUse {
//   id             String @id @default(cuid())
//   deliberationId String
//   argumentId     String

//   // Either tie to an existing claim…
//   assumptionClaimId String? // FK to Claim.id (nullable)
//   // …or store freeform text for a local assumption (one of the two must be present)
//   assumptionText    String?

//   role       String @default("premise") // 'premise'|'warrant'|'value'|… (open set)
//   weight     Float? // local weight 0..1 for this assumption (optional)
//   confidence Float? // confidence provided by author/UI (optional)
//   metaJson   Json?

//   createdAt DateTime @default(now())

//   @@index([argumentId])
//   @@index([assumptionClaimId])
// }

  // Base RA slice
  const nodes: AifNode[] = [
    { id: RA(arg.id), kind: 'RA', label: arg.text || `Argument ${arg.id.slice(0,8)}…` }
  ];
  const edges: AifEdge[] = [];
  
  if (arg.conclusionClaimId) {
    nodes.push({ id: I(arg.conclusionClaimId), kind: 'I', label: labelOf.get(arg.conclusionClaimId) ?? arg.conclusionClaimId });
    edges.push({ id: `e:${arg.id}:concl`, from: RA(arg.id), to: I(arg.conclusionClaimId), role: 'conclusion' });
  }
  
  for (const p of arg.premises) {
    nodes.push({ id: I(p.claimId), kind: 'I', label: labelOf.get(p.claimId) ?? p.claimId });
    edges.push({ id: `e:${arg.id}:prem:${p.claimId}`, from: I(p.claimId), to: RA(arg.id), role: 'premise' });
  }

  const uses = await prisma.assumptionUse.findMany({
  where: { argumentId: arg.id },
  select: { id: true, role: true }
});
for (const u of uses) {
  // add I-node (if not already)
  if (!nodes.some(n => n.id === I(u.id))) {
    const cl = await prisma.claim.findUnique({ where: { id: u.id }, select: { id:true, text:true } });
    if (cl) nodes.push({ id: I(cl.id), kind:'I', label: cl.text || cl.id });
  }
  edges.push({
    id: `e:${arg.id}:assm:${u.id}`,
    from: RA(arg.id),
    to: I(u.id),
    role: (u.role === 'exception' ? 'has-exception' : 'has-presumption')
  });
}

  // Conflicts (CA) that touch this argument or its (conclusion/premises)
  const touchingClaimIds = new Set(claimIds);
  const cas = await prisma.conflictApplication.findMany({
    where: {
      deliberationId: arg.deliberationId,
      OR: [
        { conflictedArgumentId: arg.id },
        { conflictedClaimId: { in: claimIds } },
        { conflictingArgumentId: arg.id },
        { conflictingClaimId: { in: claimIds } },
      ]
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, schemeId: true,
      conflictingArgumentId: true, conflictingClaimId: true,
      conflictedArgumentId: true,  conflictedClaimId: true,
      legacyAttackType: true, legacyTargetScope: true
    }
  });
  
  for (const c of cas) {
    const caId = CA(c.id);
    nodes.push({ id: caId, kind: 'CA', label: c.legacyAttackType ?? 'CA', schemeKey: c.legacyAttackType ?? null });
    
    // left side (conflicting)
    if (c.conflictingArgumentId) {
      if (!nodes.some(n => n.id === RA(c.conflictingArgumentId!))) {
        nodes.push({ id: RA(c.conflictingArgumentId), kind: 'RA', label: `Argument ${c.conflictingArgumentId.slice(0,8)}…` });
      }
      edges.push({ id:`e:${c.id}:confA`, from: RA(c.conflictingArgumentId), to: caId, role:'conflictingElement' });
    } else if (c.conflictingClaimId) {
      if (!touchingClaimIds.has(c.conflictingClaimId)) {
        const cl = await prisma.claim.findUnique({ where:{ id: c.conflictingClaimId }, select:{ id:true, text:true } });
        if (cl) nodes.push({ id: I(cl.id), kind:'I', label: cl.text || cl.id });
      }
      edges.push({ id:`e:${c.id}:confI`, from: I(c.conflictingClaimId!), to: caId, role:'conflictingElement' });
    }
    
    // right side (conflicted)
    if (c.conflictedArgumentId) {
      edges.push({ id:`e:${c.id}:tgtA`, from: caId, to: RA(c.conflictedArgumentId), role:'conflictedElement' });
    } else if (c.conflictedClaimId) {
      if (!nodes.some(n => n.id === I(c.conflictedClaimId!))) {
        const cl = await prisma.claim.findUnique({ where:{ id: c.conflictedClaimId! }, select:{ id:true, text:true } });
        if (cl) nodes.push({ id: I(cl.id), kind:'I', label: cl.text || cl.id });
      }
      edges.push({ id:`e:${c.id}:tgtI`, from: caId, to: I(c.conflictedClaimId!), role:'conflictedElement' });
    }
  }

  // Preferences (PA) that touch this argument or its conclusion/premises
  const pas = await prisma.preferenceApplication.findMany({
    where: {
      deliberationId: arg.deliberationId,
      OR: [
        { preferredArgumentId: arg.id }, 
        { dispreferredArgumentId: arg.id },
        ...(arg.conclusionClaimId ? [
          { preferredClaimId: arg.conclusionClaimId }, 
          { dispreferredClaimId: arg.conclusionClaimId }
        ] : []),
        ...(arg.premises.length ? [
          { preferredClaimId: { in: claimIds } }, 
          { dispreferredClaimId: { in: claimIds } }
        ] : [])
      ]
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id:true, schemeId:true,
      preferredArgumentId:true, dispreferredArgumentId:true,
      preferredClaimId:true,    dispreferredClaimId:true
    }
  });
  
  for (const p of pas) {
    const paId = PA(p.id);
    nodes.push({ id: paId, kind: 'PA', label: 'PA', schemeKey: null });
    
    // preferred
    if (p.preferredArgumentId) {
      if (!nodes.some(n => n.id === RA(p.preferredArgumentId!))) {
        nodes.push({ id: RA(p.preferredArgumentId), kind:'RA', label:`Argument ${p.preferredArgumentId.slice(0,8)}…` });
      }
      edges.push({ id:`e:${p.id}:prefA`, from: RA(p.preferredArgumentId), to: paId, role:'preferredElement' });
    } else if (p.preferredClaimId) {
      if (!nodes.some(n => n.id === I(p.preferredClaimId!))) {
        const cl = await prisma.claim.findUnique({ where:{ id: p.preferredClaimId! }, select:{ id:true, text:true } });
        if (cl) nodes.push({ id: I(cl.id), kind:'I', label: cl.text || cl.id });
      }
      edges.push({ id:`e:${p.id}:prefI`, from: I(p.preferredClaimId!), to: paId, role:'preferredElement' });
    }
    
    // dispreferred
    if (p.dispreferredArgumentId) {
      if (!nodes.some(n => n.id === RA(p.dispreferredArgumentId!))) {
        nodes.push({ id: RA(p.dispreferredArgumentId), kind:'RA', label:`Argument ${p.dispreferredArgumentId.slice(0,8)}…` });
      }
      edges.push({ id:`e:${p.id}:dispA`, from: paId, to: RA(p.dispreferredArgumentId), role:'dispreferredElement' });
    } else if (p.dispreferredClaimId) {
      if (!nodes.some(n => n.id === I(p.dispreferredClaimId!))) {
        const cl = await prisma.claim.findUnique({ where:{ id: p.dispreferredClaimId! }, select:{ id:true, text:true } });
        if (cl) nodes.push({ id: I(cl.id), kind:'I', label: cl.text || cl.id });
      }
      edges.push({ id:`e:${p.id}:dispI`, from: paId, to: I(p.dispreferredClaimId!), role:'dispreferredElement' });
    }
  }

  
  // CONVERGENT SUPPORT: ArgumentPremise.groupKey field exists in schema but the logic
  // below is UNTESTED and possibly broken. The code casts premises to any[] which suggests
  // type issues. This feature is dormant and needs validation before production use.
  // See CHUNK_1B_IMPLEMENTATION_STATUS.md Gap 1 for details.
  // TODO: Remove type cast, verify logic, add tests if convergent support is needed.
  const byGroup = new Map<string, string[]>(); // groupKey -> [claimId]
  for (const p of (arg.premises as any[])) {
    const g = (p.groupKey as string|undefined) ?? '__linked__';
    const arr = byGroup.get(g) ?? [];
    arr.push(p.claimId);
    byGroup.set(g, arr);
  }

  if (byGroup.size > 1) {
    // re‑wire to multiple RA "views"; keep original RA too
    let idx = 0;
    for (const [gk, list] of byGroup) {
      const raId = gk === '__linked__' ? RA(arg.id) : RA(`${arg.id}:${++idx}`);
      if (!nodes.some(n => n.id === raId)) nodes.push({ id: raId, kind:'RA', label: nodes.find(n => n.id===RA(arg.id))?.label ?? `Argument ${arg.id.slice(0,8)}…` });
      for (const cid of list) {
        if (!nodes.some(n => n.id === I(cid))) {
          nodes.push({ id: I(cid), kind:'I', label: labelOf.get(cid) ?? cid });
        }
        edges.push({ id: `e:${raId}:prem:${cid}`, from: I(cid), to: raId, role:'premise' });
      }
      if (arg.conclusionClaimId) {
        edges.push({ id: `e:${raId}:concl`, from: raId, to: I(arg.conclusionClaimId), role:'conclusion' });
      }
    }
  }

  // Dedupe nodes/edges
  const uniqNodes = Array.from(new Map(nodes.map(n => [n.id, n])).values());
  const uniqEdges = Array.from(new Map(edges.map(e => [e.id, e])).values());
  
  return { nodes: uniqNodes, edges: uniqEdges };
}


export async function buildDiagramForArgument(argumentId: string): Promise<Diagram|null> {
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: { 
      id: true, 
      text: true, 
      conclusionClaimId: true, 
      deliberationId: true,
      schemeId: true,
      scheme: { select: { key: true, name: true } },
      premises: {
        select: {
          claimId: true,
          claim: { select: { id: true, text: true } }
        }
      }
    }
  });
  if (!arg) return null;

  // Build statements from the argument's conclusion and premises
  const statements: Diagram['statements'] = [];
  const inferences: Diagram['inferences'] = [];
  
  // Add conclusion as a statement
  if (arg.conclusionClaimId) {
    const conclusionClaim = await prisma.claim.findUnique({
      where: { id: arg.conclusionClaimId },
      select: { id: true, text: true }
    });
    if (conclusionClaim) {
      statements.push({ 
        id: conclusionClaim.id, 
        text: conclusionClaim.text ?? '', 
        kind: 'claim' 
      });
    }
  }
  
  // Add each premise as a statement
  const premiseStatementIds: string[] = [];
  for (const premise of arg.premises) {
    if (premise.claim) {
      statements.push({
        id: premise.claim.id,
        text: premise.claim.text ?? '',
        kind: 'premise'
      });
      premiseStatementIds.push(premise.claim.id);
    }
  }
  
  // Create an inference linking premises to conclusion
  if (arg.conclusionClaimId && premiseStatementIds.length > 0) {
    const conclusionClaim = await prisma.claim.findUnique({
      where: { id: arg.conclusionClaimId },
      select: { id: true, text: true }
    });
    
    inferences.push({
      id: `inf_${arg.id}`,
      kind: arg.scheme?.key || 'defeasible',
      conclusion: { 
        id: arg.conclusionClaimId, 
        text: conclusionClaim?.text ?? '' 
      },
      premises: premiseStatementIds.map(pid => {
        const stmt = statements.find(s => s.id === pid);
        return { statement: { id: pid, text: stmt?.text ?? '' } };
      }),
      scheme: arg.scheme?.key || null,
    });
  }

  // Also check for ArgumentEdges → treat as additional supports
  const edges = await prisma.argumentEdge.findMany({
    where: { deliberationId: arg.deliberationId, toArgumentId: arg.id },
    select: { fromArgumentId: true, type: true },
  });

  const supportIds = edges
    .filter(e => (String(e.type).toLowerCase() === 'support') || (String(e.type).toLowerCase() === 'grounds'))
    .map(e => e.fromArgumentId);

  const premArgs = supportIds.length
    ? await prisma.argument.findMany({ where: { id: { in: supportIds } }, select: { id: true, text: true } })
    : [];
  
  // Add supporting arguments as additional premises
  for (const p of premArgs) {
    if (!statements.find(s => s.id === p.id)) {
      statements.push({ id: p.id, text: p.text ?? '', kind: 'premise' });
    }
  }

  const evidence: Diagram['evidence'] = [];

  // Attach AIF view
  const aif = await buildAifSubgraphForArgument(argumentId).catch(() => null);
  return { id: `synth:${arg.id}`, title: null, statements, inferences, evidence, ...(aif ? { aif } : {}) };
}
