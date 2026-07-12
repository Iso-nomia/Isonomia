export const dynamic = "force-dynamic";

// API route to handle batch import of AIF JSON-LD data
// app/api/aif/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { TargetType } from '@prisma/client';
import { checkAifVersionStamp } from '@/lib/aif/version';
import { mintClaimMoid } from '@/lib/ids/mintMoid';

type Mode = 'validate'|'upsert';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode: Mode = (body?.options?.mode || 'validate');
  const nodes: any[] = Array.isArray(body?.['@graph']) ? body['@graph'] : [];

  const errors: Array<{ path: string; message: string }> = [];
  const inferences: any[] = [];

  // Q-023 version pin (folksonomy step 16): every batch document must carry
  // an explicit AIF version stamp. `validate` mode tolerates legacy
  // unstamped documents but emits a warning so callers can be migrated;
  // `upsert` always hard-rejects unstamped or mismatched documents.
  const allowUnstamped = mode === 'validate';
  const stampCheck = checkAifVersionStamp(body, allowUnstamped);
  if (!stampCheck.ok) {
    return NextResponse.json(
      { ok: false, error: stampCheck.code, message: stampCheck.message, expected: stampCheck.expected, got: stampCheck.got },
      { status: 422, ...NO_STORE },
    );
  }
  const versionWarnings: Array<{ path: string; message: string }> = [];
  if (allowUnstamped && body && typeof body === 'object' && (body as any).aifVersion === undefined && (body as any).meshAifProfile === undefined) {
    versionWarnings.push({
      path: 'aifVersion',
      message: 'Document is missing aifVersion/meshAifProfile stamp. Accepted in validate mode only — upsert will reject.',
    });
  }

  // --- super-light structural validation ---
  // Expect: I nodes, RA nodes, Premise edges (I->RA), Conclusion edges (RA->I)
  const ids = new Set(nodes.filter(n => n['@id']).map(n => n['@id']));
  const byType = (t: string) => nodes.filter(n => {
    const ty = n['@type'];
    return (Array.isArray(ty) ? ty : [ty]).includes(t);
  });

  const I = byType('aif:InformationNode');
  const RA = byType('aif:RA');
  const Prem = byType('aif:Premise');
  const Conc = byType('aif:Conclusion');

  if (!RA.length) errors.push({ path: '@graph', message: 'No aif:RA nodes found' });
  for (const e of Prem) {
    if (!ids.has(e['aif:from'])) errors.push({ path: 'Premise', message: `missing I node ${e['aif:from']}` });
    if (!ids.has(e['aif:to'])) errors.push({ path: 'Premise', message: `missing RA node ${e['aif:to']}` });
  }
  for (const e of Conc) {
    if (!ids.has(e['aif:from'])) errors.push({ path: 'Conclusion', message: `missing RA node ${e['aif:from']}` });
    if (!ids.has(e['aif:to'])) errors.push({ path: 'Conclusion', message: `missing I node ${e['aif:to']}` });
  }

  // Optional: check CQs attached to RA
  const CQEdges = nodes.filter(n => n['@type'] === 'as:hasCriticalQuestion');
  for (const e of CQEdges) {
    if (!ids.has(e['aif:from'])) errors.push({ path: 'hasCriticalQuestion', message: `missing RA ${e['aif:from']}` });
    if (!ids.has(e['aif:to'])) errors.push({ path: 'hasCriticalQuestion', message: `missing CQ ${e['aif:to']}` });
  }

  if (mode === 'validate' || errors.length) {
    return NextResponse.json({ ok: errors.length === 0, errors, inferences, warnings: versionWarnings }, { status: errors.length ? 422 : 200, ...NO_STORE });
  }

  // --- upsert (minimal RA import: create Argument + ArgumentPremise) ---
  // Assumptions:
  // - We import into a single deliberation (required option)
  // - aif:InformationNode carry "aif:text"
  const deliberationId: string | undefined = body?.options?.deliberationId;
  const authorId: string | undefined = body?.options?.authorId;
  if (!deliberationId || !authorId) {
    return NextResponse.json({ ok:false, error: 'options.deliberationId and options.authorId are required for upsert' }, { status: 400, ...NO_STORE });
  }

  // Map JSON-LD I-ids to Claim ids (create if needed)
  const IText = new Map(I.map(n => [n['@id'], String(n['aif:text'] || '')]));
  const claimIdByNode = new Map<string, string>();

  await prisma.$transaction(async (tx) => {
    // Create claims
    for (const [nodeId, text] of IText) {
      const c = await tx.claim.create({ data: { text, moid: mintClaimMoid(text), createdById: authorId, deliberationId } });
      claimIdByNode.set(nodeId, c.id);
    }

    // Create arguments for each RA: premises + conclusion
    for (const r of RA) {
      const raId = r['@id'];
      const schemeKey: string | null = r['aif:usesScheme'] || r['as:appliesSchemeKey'] || null;
      const fingerprint: string | null = r['mesh:behaviourFingerprint'] || r.behaviourFingerprint || null;

      const premEdges = Prem.filter(p => p['aif:to'] === raId);
      const concEdge  = Conc.find(c => c['aif:from'] === raId);
      if (!concEdge) continue;

      const conclusionClaimId = claimIdByNode.get(concEdge['aif:to'])!;
      const premiseClaimIds = premEdges.map(p => claimIdByNode.get(p['aif:from'])!).filter(Boolean);

      // Phase 4c (folksonomy step 17): resolve schemeId by key first, then by
      // behaviourFingerprint as a candidate-set hint.
      let resolvedSchemeId: string | null = null;
      if (schemeKey) {
        const byKey = await tx.argumentScheme.findFirst({
          where: { key: schemeKey, kind: 'argument-scheme' },
          select: { id: true },
        }).catch(() => null);
        if (byKey) resolvedSchemeId = byKey.id;
      }
      if (!resolvedSchemeId && fingerprint) {
        const byFp = await tx.argumentScheme.findFirst({
          where: { fingerprint, kind: 'argument-scheme' },
          select: { id: true, key: true },
        }).catch(() => null);
        if (byFp) {
          resolvedSchemeId = byFp.id;
          // eslint-disable-next-line no-console
          console.info('[aif-batch-upsert] fingerprint match', { ra: raId, fingerprint, schemeId: byFp.id, schemeKey: byFp.key });
        }
      }

      const a = await tx.argument.create({
        data: {
          deliberationId, authorId, text: '',
          conclusionClaimId,
          schemeId: resolvedSchemeId,
        }
      });
      if (premiseClaimIds.length) {
        await tx.argumentPremise.createMany({
          data: premiseClaimIds.map(cid => ({ argumentId: a.id, claimId: cid, isImplicit: false })),
          skipDuplicates: true
        });
      }

      // CQ statuses (optional)
      const cqForThisRA = CQEdges
        .filter(e => e['aif:from'] === raId)
        .map(e => nodes.find(n => n['@id'] === e['aif:to']))
        .filter(Boolean) as any[];
      for (const q of cqForThisRA) {
        const cqKey = String(q?.['cq:key'] || '');
        const status = String(q?.['cq:status'] || 'open');
        if (!cqKey) continue;
        await tx.cQStatus.upsert({
          where: { targetType_targetId_schemeKey_cqKey: { targetType: 'argument' as TargetType, targetId: a.id, schemeKey: schemeKey || 'unknown', cqKey } },
          create: { targetType: 'argument' as TargetType, targetId: a.id, argumentId: a.id, schemeKey: schemeKey || 'unknown', cqKey, status, createdById: authorId },
          update: { status }
        });
      }
    }
  });

  return NextResponse.json({ ok:true, upserted: true }, { status: 201, ...NO_STORE });
}
