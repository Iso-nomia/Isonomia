// app/api/evidential/score/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { TargetType } from "@prisma/client";
import { corroborateProbs } from "@/lib/argumentation/logodds";

type Mode = "min"|"prod"|"logodds";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const deliberationId = String(u.searchParams.get("deliberationId") ?? "");
  const tau = Math.max(0, Math.min(1, Number(u.searchParams.get("tau") ?? 0.7)));
  const explain = u.searchParams.get("explain") === "1";
const idsParam = (u.searchParams.get("ids") || "").trim();
  const onlyIds = idsParam ? idsParam.split(",").map(s => s.trim()).filter(Boolean) : null;
 
  if (!deliberationId) return NextResponse.json({ ok:false, error:"missing deliberationId" }, { status:400 });

  // Get debate sheet to read default mode from rulesetJson
  const sheet = await prisma.debateSheet.findFirst({
    where: { deliberationId },
    select: { rulesetJson: true }
  });
  
  // Phase 5a: "ds" retired from the evidential pipeline. Coerce any persisted/inbound
  // "ds" mode to "prod" (its closest surviving reducer) for one deprecation cycle.
  // Phase 5b step 1: the no-mode default is now "logodds" (was "product"); explicit
  // persisted/query modes are still honoured. Revert the bake via the persisted
  // sheet mode or an explicit ?mode=product.
  const persistedMode = (sheet?.rulesetJson as any)?.confidence?.mode;
  const defaultMode = persistedMode === "ds" ? "product" : (persistedMode ?? "logodds");
  const rawModeIn = String(u.searchParams.get("mode") ?? defaultMode).toLowerCase();
  const rawMode = rawModeIn === "ds" ? "product" : rawModeIn;
  const mode: Mode = (rawMode === "product" ? "prod" : (rawMode as Mode)) || "min";

  // Pull minimal neighborhood for this room + CQ statuses for arguments
   const [claims, args, edges, cqStatuses] = await Promise.all([
    prisma.claim.findMany({
      where: {
        deliberationId,
        ...(onlyIds ? { id: { in: onlyIds } } : {})
      },
      select:{ id:true, text:true }
    }),
    prisma.argument.findMany({
      where:{ deliberationId },
      select:{ id:true, text:true, conclusionClaimId:true,
               premises:{ select:{ claimId:true, isImplicit:true } },
               scheme:{ select:{ validators:true } } }
    }),
    prisma.argumentEdge.findMany({
      where:{ deliberationId },
      select:{ id:true, type:true, attackType:true, targetScope:true,
               fromArgumentId:true, toArgumentId:true,
               targetClaimId:true, targetPremiseId:true }
    }),
    prisma.cQStatus.findMany({
      where: { 
        targetType: "argument" as TargetType,
        argumentId: { not: null }
      },
      select: { argumentId: true, cqKey: true, satisfied: true }
    })
  ]);

  // Build CQ map: argumentId → unsatisfied count
  const cqMap = new Map<string, number>();
  for (const cq of cqStatuses) {
    if (cq.argumentId && !cq.satisfied) {
      const count = cqMap.get(cq.argumentId) ?? 0;
      cqMap.set(cq.argumentId, count + 1);
    }
  }

  // Indexes
  const argsByConclusion = new Map<string, any[]>();
  for (const a of args) {
    const k = a.conclusionClaimId ?? "__none__";
    const list = argsByConclusion.get(k) ?? [];
    list.push(a); argsByConclusion.set(k, list);
  }

  const rebutByClaim = new Map<string, any[]>();
  const undercutsByArg = new Map<string, any[]>();
  const underminesByPrem = new Map<string, any[]>();
  for (const e of edges) {
    if (String(e.attackType).toUpperCase() === "REBUTS" && e.targetClaimId) {
      (rebutByClaim.get(e.targetClaimId) ?? rebutByClaim.set(e.targetClaimId, []), rebutByClaim.get(e.targetClaimId)!).push(e);
    }
    if (String(e.type).toLowerCase() === "undercut" || String(e.attackType).toUpperCase() === "UNDERCUTS") {
      if (e.toArgumentId) (undercutsByArg.get(e.toArgumentId) ?? undercutsByArg.set(e.toArgumentId, []), undercutsByArg.get(e.toArgumentId)!).push(e);
    }
    if (String(e.attackType).toUpperCase() === "UNDERMINES" && e.targetPremiseId) {
      (underminesByPrem.get(e.targetPremiseId) ?? underminesByPrem.set(e.targetPremiseId, []), underminesByPrem.get(e.targetPremiseId)!).push(e);
    }
  }

  // Recursive support with memo
  const memo = new Map<string, { score:number, bel?:number, pl?:number, explain?:any }>();
  const prior = 0.5; // neutral prior for leaf claims (can be parameterized)
  const inProgress = new Set<string>(); // Cycle detection: tracks claims currently being evaluated

  function combineChains(chains:number[]): number {
    if (!chains.length) return 0;
    if (mode === "min") return Math.max(...chains);               // best single line
    // weight-of-evidence corroboration: log-odds add (no noisy-OR ceiling)
    if (mode === "logodds") return corroborateProbs(chains);
    // noisy-OR for independent lines
    const prodNot = chains.reduce((p, s) => p * (1 - s), 1);
    return 1 - prodNot;
  }

  function supportClaim(claimId: string): { score:number, bel?:number, pl?:number, explain?:any } {
    const cached = memo.get(claimId);
    if (cached) return cached;

    // Cycle detection: if we're already computing this claim, return neutral prior to break cycle
    if (inProgress.has(claimId)) {
      const cycleResult = { score: prior, bel: prior, pl: 1, explain: explain ? { kind:"cycle", prior } : undefined };
      return cycleResult; // Don't cache this - it's a temporary value during cycle resolution
    }

    // Mark this claim as in-progress
    inProgress.add(claimId);

    try {
      const supporters = argsByConclusion.get(claimId) ?? [];
      if (!supporters.length) {
        const leaf = { score: prior, bel: prior, pl: 1, explain: { kind:"leaf", prior } };
        memo.set(claimId, leaf); return leaf;
      }

      const chainScores:number[] = [];
      const chainExpls:any[] = [];

      for (const a of supporters) {
        // Get scheme base confidence (default 0.6 if not specified)
        const schemeBase = (a.scheme?.validators as any)?.baseConfidence ?? 0.6;
        
        // premise aggregation
        const premSupports = a.premises.map((p:any) => supportClaim(p.claimId).score);
        const premMin = premSupports.length ? Math.min(...premSupports) : prior;
        const premProd = premSupports.length ? premSupports.reduce((x: number,y: number)=>x*y,1) : prior;
        
        // Start with scheme base, then modulate by premises
        let chain = schemeBase * (
          mode === "min"  ? premMin :
          mode === "prod" ? premProd :
          mode === "logodds" ? premProd : premMin
        );

        // Apply CQ penalty: 0.85^(unsatisfiedCount)
        const unsatisfiedCQCount = cqMap.get(a.id) ?? 0;
        const cqPenalty = Math.pow(0.85, unsatisfiedCQCount);
        chain = chain * cqPenalty;

        // undercuts to this argument reduce chain strength
        const u = undercutsByArg.get(a.id) ?? [];
        if (u.length) {
          // crude: treat each undercut as independent defeat with strength = average of its own conclusion supports if available
          const defeat = Math.max(0, Math.min(1, 1 - (1 - 0.4) ** u.length)); // fallback hedge if we can't resolve attacker strengths
          chain = chain * (1 - defeat);
        }

        // undermines to specific premises reduce that premise before aggregation (already implicit if we computed prem supports);
        // (optional) could downweight premSupports where undermines exist.

        chainScores.push(chain);
        if (explain) chainExpls.push({ 
          argumentId: a.id,
          schemeBase,
          premises: a.premises.map((p:any)=>({ id:p.claimId, s: supportClaim(p.claimId).score })), 
          unsatisfiedCQs: unsatisfiedCQCount,
          cqPenalty,
          chain 
        });
      }

      // combine multiple lines
      const score = combineChains(chainScores);

      // rebut attacks (to the conclusion) down‑adjust
      const rebuts = rebutByClaim.get(claimId) ?? [];
      if (rebuts.length) {
        // Estimate counter strength as the combined support of the counterclaims (if their args present), else hedge 0.4
        const counter = 1 - (1 - 0.4) ** rebuts.length;
        const adjusted = score * (1 - counter);
        const result = { score: adjusted, explain: explain ? { lines: chainExpls, rebutCount: rebuts.length, preRebut: score } : undefined };
        memo.set(claimId, result); return result;
      }

      const result = { score, explain: explain ? { lines: chainExpls } : undefined };

      memo.set(claimId, result);
      return result;
    } finally {
      // Always remove from in-progress set when done (even if error thrown)
      inProgress.delete(claimId);
    }
  }

  const claimItems = claims.map(c => {
    const s = supportClaim(c.id);
    const accepted = (s.score ?? s.bel ?? 0) >= tau;
    return { id: c.id, text: c.text ?? "", score: s.score, bel: s.bel, pl: s.pl, accepted, explain: explain ? s.explain : undefined };
  });

  return NextResponse.json({ ok:true, mode, modeUsed: mode, tau, items: claimItems }, { headers: { "Cache-Control":"no-store" }});
}
