export const dynamic = "force-dynamic";

// app/api/monological/extract/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

function uniq(xs: string[] = []) {
  const s = new Set<string>();
  return xs.filter(t => {
    const k = t.trim().toLowerCase();
    if (!k) return false;
    if (s.has(k)) return false;
    s.add(k);
    return true;
  });
}

export async function GET(req: NextRequest) {
  const argumentId = req.nextUrl.searchParams.get('argumentId');
  if (!argumentId) {
    return NextResponse.json({ ok:false, error:'argumentId required' }, { status: 400 });
  }

  // ✅ include text so we can safely test connectives
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: { id: true, claimId: true, text: true }, // <-- added text
  });

  // canonical stores
  const mp = await prisma.missingPremise.findMany({
    where: { targetType: 'argument', targetId: argumentId },
    select: { premiseType: true, text: true },
  });

  const aa = await prisma.argumentAnnotation.findMany({
    where: {
      targetType: 'argument',
      targetId: argumentId,
      type: { startsWith: 'monological:' },
    },
    select: { type: true, text: true },
  });

  const cw = arg?.claimId
    ? await prisma.claimWarrant.findMany({
        where: { claimId: arg.claimId },
        select: { text: true },
      })
    : [];

  // 🔸 optional: defaults (enthymemes) attached to this argument
  const dr = await prisma.defaultRule.findMany({
    where: { argumentId },
    select: {
      id: true, role: true, antecedent: true, justification: true, consequent: true, createdAt: true
    }
  });

  // collect slots
  const acc: Record<'grounds'|'warrant'|'backing'|'qualifier'|'rebuttal'|'claim', string[]> = {
    grounds: [], warrant: [], backing: [], qualifier: [], rebuttal: [], claim: [],
  };

  for (const r of mp) {
    const t = (r.premiseType || '').toLowerCase();
    const slot =
      t === 'ground' || t === 'grounds' || t === 'premise' ? 'grounds' :
      t === 'warrant'  ? 'warrant'  :
      t === 'backing'  ? 'backing'  :
      t === 'qualifier'? 'qualifier':
      t === 'rebuttal' ? 'rebuttal' : null;
    if (slot) acc[slot].push(r.text);
  }

  for (const r of aa) {
    const t = (r.type || '').toLowerCase().replace('monological:', '');
    const slot =
      t === 'ground' || t === 'grounds' ? 'grounds' :
      t === 'warrant'  ? 'warrant'  :
      t === 'backing'  ? 'backing'  :
      t === 'qualifier'? 'qualifier':
      t === 'rebuttal' ? 'rebuttal' : null;
    if (slot) acc[slot].push(r.text);
  }

  for (const r of cw) acc.warrant.push(r.text);

  const slots = {
    claim:     uniq(acc.claim).slice(0, 5),
    grounds:   uniq(acc.grounds).slice(0, 5),
    warrant:   uniq(acc.warrant).slice(0, 5),
    backing:   uniq(acc.backing).slice(0, 5),
    qualifier: uniq(acc.qualifier).slice(0, 5),
    rebuttal:  uniq(acc.rebuttal).slice(0, 5),
  };

  // ✅ connective cues use arg?.text safely now
  const connectives = {
    therefore: /\b(therefore|thus|hence|so|thereby)\b/i.test(arg?.text ?? ''),
    suppose:   /\b(suppose|assuming that|let's assume|let us assume)\b/i.test(arg?.text ?? '')
  };

  return NextResponse.json({ ok: true, slots, meta: { defaults: dr, connectives } });
}
