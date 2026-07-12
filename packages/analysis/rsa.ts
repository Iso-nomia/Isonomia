import { prisma } from '@/lib/prismaclient';

// Tiny tokenizer + cosine
function tokenize(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
}
function cosine(a: Record<string,number>, b: Record<string,number>) {
  let dot=0, na=0, nb=0;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) { const x=a[k]||0, y=b[k]||0; dot+=x*y; na+=x*x; nb+=y*y; }
  return (na && nb) ? dot / (Math.sqrt(na)*Math.sqrt(nb)) : 0;
}
function toVec(tokens: string[]) {
  const v: Record<string,number> = {};
  for (const t of tokens) v[t]=(v[t]||0)+1;
  return v;
}

export async function computeRSAForArgument(deliberationId: string, argumentId: string) {
  // 1) Target text
  const arg = await prisma.argument.findUnique({ where:{ id:argumentId }, select:{ text:true, sources:true }});
  const text = arg?.text || '';

  // 2) Grounds from argument: GROUNDS moves on this argument target
  const groundsMoves = await prisma.dialogueMove.findMany({
    where: { deliberationId, targetType: 'argument', targetId: argumentId, kind: 'GROUNDS' },
    orderBy: { createdAt: 'asc' },
    select: { payload:true }
  }); // DialogueMove has targetType/kind/payload fields :contentReference[oaicite:2]{index=2}
  const grounds = groundsMoves.map(m => String((m.payload as any)?.brief || (m.payload as any)?.note || '')).filter(Boolean);
  const groundsText = grounds.join(' . ');

  // 3) Relevance by cosine between argument text and concatenated grounds
  const R = (groundsText.trim().length>0)
    ? cosine(toVec(tokenize(text)), toVec(tokenize(groundsText)))
    : 0.5; // neutral if no grounds yet

  // 4) Sufficiency: (# grounds + # supports edges) normalized + CQ satisfied on associated claim (if any)
  const supports = await prisma.argumentEdge.count({
    where: { deliberationId, toArgumentId: argumentId, type: 'support' }
  }); // ArgumentEdge.type support/rebut/undercut :contentReference[oaicite:3]{index=3}
  const baseS = Math.min(1, (grounds.length + supports) / 3);
  // CQ satisfied via SchemeInstances would be on claims; keep baseS for arguments
  const S = baseS;

  // 5) Acceptability: presence/quality of sources (URLs) + basic warrant fit if promoted to claim later
  const srcCount = Array.isArray(arg?.sources) ? (arg?.sources as any[]).length : 0;
  const A = Math.min(1, (srcCount ? 0.6 + Math.min(0.4, srcCount/5) : 0.4));

  return {
    R: Number(R.toFixed(3)), S: Number(S.toFixed(3)), A: Number(A.toFixed(3)),
    notes: {
      R: grounds.length ? [`${grounds.length} grounds used`] : ['No grounds yet'],
      S: [`grounds:${grounds.length}`, `supports:${supports}`],
      A: [`sources:${srcCount}`],
    }
  };
}

export async function computeRSAForClaim(deliberationId: string, claimId: string) {
  // 1) Claim text + warrant + evidence
  const claim = await prisma.claim.findUnique({
    where:{ id: claimId },
    select:{ text:true, warrant:{ select:{ id:true }}, ClaimEvidence: { select:{ id:true } } }
  }); // Claim, ClaimWarrant, EvidenceLink exist in schema :contentReference[oaicite:4]{index=4}
  const text = claim?.text || '';

  // 2) Supporting claim edges and card reasons
  const supports = await prisma.claimEdge.count({
    where: { toClaimId: claimId, type: 'supports' }
  }); // ClaimEdge.type supports/rebuts :contentReference[oaicite:5]{index=5}
  const rebutCount = await prisma.claimEdge.count({ where: { toClaimId: claimId, type: 'rebuts' }});

  // 3) Relevance: use supporting claims' text as “grounds”
  const supTexts = await prisma.claim.findMany({
    where: { edgesFrom: { some: { toClaimId: claimId, type: 'supports' } } },
    select:{ text:true }
  });
  const groundsText = supTexts.map(x=>x.text).join(' . ');
  const R = (groundsText.trim().length>0)
    ? cosine(toVec(tokenize(text)), toVec(tokenize(groundsText)))
    : 0.6;

  // 4) Sufficiency: supports & CQ satisfied for this claim
  const cqsSatisfied = await prisma.cQStatus.count({
    where: { targetType: 'claim', targetId: claimId, satisfied: true }
  }); // CQStatus table for critical questions :contentReference[oaicite:6]{index=6}
  const S = Math.min(1, (supports + cqsSatisfied) / 4);

  // 5) Acceptability: evidence links & warrant present
  const evidence = claim?.ClaimEvidence?.length ?? 0;
  const hasWarrant = !!claim?.warrant;
  const A = Math.min(1, (evidence ? 0.5 + Math.min(0.5, evidence/6) : 0.4) + (hasWarrant ? 0.1 : 0));

  return {
    R: Number(R.toFixed(3)),
    S: Number(S.toFixed(3)),
    A: Number(A.toFixed(3)),
    notes: {
      R: supTexts.length ? [`${supTexts.length} supporting claims`] : ['No supports yet'],
      S: [`supports:${supports}`, `CQs✓:${cqsSatisfied}`, `rebuts:${rebutCount}`],
      A: [`evidence:${evidence}`, hasWarrant ? 'warrant:yes' : 'warrant:no'],
    }
  };
}
