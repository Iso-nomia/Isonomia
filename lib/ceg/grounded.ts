// lib/ceg/grounded.ts
import { prisma } from '@/lib/prismaclient';
import { writeBeliefRevisionProposals } from './beliefRevision';

type Edge = { from: string; to: string; isAttack: boolean };
type Label = 'IN' | 'OUT' | 'UNDEC';

function groundedLabels(nodes: string[], edges: Edge[]): Map<string, Label> {
  // Build attackers and supporters maps
  const attackers = new Map<string, Set<string>>();
  const supporters = new Map<string, Set<string>>();
  
  nodes.forEach(n => {
    attackers.set(n, new Set());
    supporters.set(n, new Set());
  });
  
  edges.forEach(e => {
    if (e.isAttack) {
      if (!attackers.has(e.to)) attackers.set(e.to, new Set());
      attackers.get(e.to)!.add(e.from);
    } else {
      // Support edge
      if (!supporters.has(e.to)) supporters.set(e.to, new Set());
      supporters.get(e.to)!.add(e.from);
    }
  });

  const label = new Map<string, Label>();
  nodes.forEach(n => label.set(n, 'UNDEC'));

  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      const atk = [...(attackers.get(n) ?? new Set())];
      const sup = [...(supporters.get(n) ?? new Set())];
      
      const anyIn = atk.some(a => label.get(a) === 'IN');
      const allOut = atk.length === 0 || atk.every(a => label.get(a) === 'OUT');
      
      // Support-aware: count IN supporters
      const supportStrength = sup.filter(s => label.get(s) === 'IN').length;
      
      // Accept if all attackers OUT and has support (or no attackers)
      const shouldAccept = allOut && (supportStrength > 0 || atk.length === 0);
      
      if (shouldAccept && label.get(n) !== 'IN') { 
        label.set(n, 'IN'); 
        changed = true; 
        continue; 
      }
      if (anyIn && label.get(n) !== 'OUT') { 
        label.set(n, 'OUT'); 
        changed = true; 
        continue; 
      }
      // else stays UNDEC
    }
  }
  return label;
}

/**
 * Compute grounded labels for a deliberation's claims and persist ClaimLabel rows.
 * Edges count as ATTACK if (type='rebuts') OR (attackType in ['UNDERCUTS','UNDERMINES']).
 * Support edges are derived from ArgumentPremise (premise claim → conclusion claim).
 */
export async function recomputeGroundedForDelib(deliberationId?: string | null) {
  const claims = await prisma.claim.findMany({
    where: deliberationId ? { deliberationId } : {},
    select: { id: true },
  });
  const ids = claims.map(c => c.id);
  if (ids.length === 0) return { count: 0 };

  // Get explicit ClaimEdges
  const edgesRaw = await prisma.claimEdge.findMany({
    where: deliberationId ? { deliberationId } : {},
    select: { fromClaimId: true, toClaimId: true, type: true, attackType: true },
  });

  const edges: Edge[] = edgesRaw.map(e => ({
    from: e.fromClaimId,
    to: e.toClaimId,
    isAttack: e.type === 'rebuts' || e.attackType === 'UNDERCUTS' || e.attackType === 'UNDERMINES',
  }));

  // Derive attack edges from ArgumentEdge.attackType (Phase-3 / dialectical
  // testing writes attacks here, not into ClaimEdge or ConflictApplication).
  // Source claim = attacker arg's conclusion. Target claim = explicit
  // targetClaimId / targetPremiseId, falling back to defender arg's conclusion.
  const attackEdges = await prisma.argumentEdge.findMany({
    where: deliberationId
      ? { deliberationId, attackType: { not: null } }
      : { attackType: { not: null } },
    select: {
      fromArgumentId: true,
      toArgumentId: true,
      attackType: true,
      targetClaimId: true,
      targetPremiseId: true,
    },
  });

  // Derive support edges from ArgumentPremise (RA-node structure)
  const premises = await prisma.argumentPremise.findMany({
    where: deliberationId ? {
      argument: { deliberationId },
    } : {},
    select: {
      argumentId: true,
      claimId: true,
    },
  });

  // Build map: argumentId → conclusionClaimId
  const argToConclusionMap = new Map<string, string>();
  const argsForSupport = await prisma.argument.findMany({
    where: deliberationId ? { deliberationId } : {},
    select: { id: true, conclusionClaimId: true },
  });
  argsForSupport.forEach(arg => {
    if (arg.conclusionClaimId) {
      argToConclusionMap.set(arg.id, arg.conclusionClaimId);
    }
  });

  // Add derived support edges
  for (const premise of premises) {
    const conclusionClaimId = argToConclusionMap.get(premise.argumentId);
    
    if (premise.claimId && conclusionClaimId && premise.claimId !== conclusionClaimId) {
      edges.push({
        from: premise.claimId,  // Premise I-node
        to: conclusionClaimId,  // Conclusion I-node
        isAttack: false,        // Support edge
      });
    }
  }

  // Add derived attack edges from ArgumentEdge
  for (const ae of attackEdges) {
    const fromClaimId = argToConclusionMap.get(ae.fromArgumentId);
    const toClaimId =
      ae.targetClaimId ??
      ae.targetPremiseId ??
      argToConclusionMap.get(ae.toArgumentId) ??
      null;

    if (fromClaimId && toClaimId && fromClaimId !== toClaimId) {
      edges.push({
        from: fromClaimId,
        to: toClaimId,
        isAttack: true,
      });
    }
  }

  const labels = groundedLabels(ids, edges);

  // Build explanations (include both attackers and supporters)
  const attackersByTarget = new Map<string, string[]>();
  const supportersByTarget = new Map<string, string[]>();
  
  edges.forEach(e => {
    if (e.isAttack) {
      if (!attackersByTarget.has(e.to)) attackersByTarget.set(e.to, []);
      attackersByTarget.get(e.to)!.push(e.from);
    } else {
      if (!supportersByTarget.has(e.to)) supportersByTarget.set(e.to, []);
      supportersByTarget.get(e.to)!.push(e.from);
    }
  });

  const toUpsert = [...labels.entries()].map(([claimId, lab]) => {
    const atk = attackersByTarget.get(claimId) ?? [];
    const sup = supportersByTarget.get(claimId) ?? [];
    const supInCount = sup.filter(s => labels.get(s) === 'IN').length;
    
    const explain = {
      attackers: atk.map(id => ({ id, label: labels.get(id) })),
      supporters: sup.map(id => ({ id, label: labels.get(id) })),
      supportStrength: supInCount,
      note:
        lab === 'IN'
          ? `All attackers are OUT and has ${supInCount} IN supporters`
          : lab === 'OUT'
          ? 'Has an attacker that is IN'
          : 'Neither condition holds',
    };
    return { claimId, label: lab, explainJson: explain };
  });

  // Upsert ClaimLabel (unique on claimId) — fetch the prior labels first so
  // the Sprint D belief-revision hook can detect transitions to OUT.
  const priorLabels = new Map<string, string>(
    (await prisma.claimLabel.findMany({
      where: { claimId: { in: toUpsert.map((r) => r.claimId) } },
      select: { claimId: true, label: true },
    })).map((r) => [r.claimId, String(r.label)])
  );

  for (const row of toUpsert) {
    await prisma.claimLabel.upsert({
      where: { claimId: row.claimId },
      update: {
        label: row.label as any,
        semantics: 'grounded',
        explainJson: row.explainJson as any,
        computedAt: new Date(),
        ...(deliberationId ? { deliberationId } : {}),
      },
      create: {
        claimId: row.claimId,
        semantics: 'grounded',
        label: row.label as any,
        explainJson: row.explainJson as any,
        computedAt: new Date(),
        ...(deliberationId ? { deliberationId } : {}),
      },
    });
  }

  // Sprint D1 — fire belief-revision proposal hook for any claim whose
  // grounded label transitioned **into** OUT this run. Failures here are
  // isolated; a missing proposal must never block a label commit.
  if (deliberationId) {
    const flippedToOut = toUpsert
      .filter((r) => r.label === 'OUT' && (priorLabels.get(r.claimId) ?? null) !== 'OUT')
      .map((r) => r.claimId);
    if (flippedToOut.length > 0) {
      writeBeliefRevisionProposals(deliberationId, flippedToOut).catch((err) => {
        console.error('[grounded] belief-revision hook failed:', err);
      });
    }
  }

  return { count: ids.length };
}
