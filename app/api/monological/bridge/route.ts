export const dynamic = "force-dynamic";

// app/api/monological/bridge/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prismaclient';
// import { getCurrentUserId } from '@/lib/serverutils';
// import { Prisma } from '@prisma/client';
// import { createHash } from 'crypto';

// type Intent = 'justify' | 'explain';


// // --- helpers -------------------------------------------------
// function uniq(xs: string[] = []) {
//   const s = new Set<string>();
//   return xs.filter(t => {
//     const k = t.trim().toLowerCase();
//     if (!k) return false;
//     if (s.has(k)) return false;
//     s.add(k);
//     return true;
//   });
// }
// function sig(s: string) {
//   return createHash('sha1').update(s).digest('hex').slice(0, 16);
// }
// async function createMoveSafe(data: {
//   deliberationId: string;
//   targetType: 'argument'|'claim';
//   targetId: string;
//   kind: 'ASSERT'|'WHY'|'GROUNDS';
//   payload: any;
//   actorId?: string|null;
//   signature: string;
// }) {
//   try {
//     return await prisma.dialogueMove.create({ data });
//   } catch (e:any) {
//     if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
//       return await prisma.dialogueMove.findFirst({
//         where: { deliberationId: data.deliberationId, signature: data.signature },
//         orderBy: { createdAt: 'desc' }
//       });
//     }
//     throw e;
//   }
// }

// // --- core extraction (same mapping as /api/monological/extract) ----------
// async function gatherSlots(argumentId: string) {
//   const arg = await prisma.argument.findUnique({
//     where: { id: argumentId }, select: { id:true, deliberationId:true, claimId:true, text:true }
//   });
//   if (!arg) return null;

//   const mp = await prisma.missingPremise.findMany({
//     where: { targetType:'argument', targetId: argumentId },
//     select: { premiseType:true, text:true }
//   });
//   const aa = await prisma.argumentAnnotation.findMany({
//     where: { targetType:'argument', targetId: argumentId, type: { startsWith: 'monological:' } },
//     select: { type:true, text:true }
//   });
//   const cw = arg.claimId ? await prisma.claimWarrant.findMany({
//     where: { claimId: arg.claimId }, select: { text:true }
//   }) : [];

//   const acc = { grounds:[] as string[], warrant:[] as string[], backing:[] as string[], qualifier:[] as string[], rebuttal:[] as string[], claim:[] as string[] };

//   for (const r of mp) {
//     const t = (r.premiseType || '').toLowerCase();
//     const slot =
//       t === 'ground' || t === 'grounds' ? 'grounds' :
//       t === 'warrant'  ? 'warrant' :
//       t === 'backing'  ? 'backing' :
//       t === 'qualifier'? 'qualifier' :
//       t === 'rebuttal' ? 'rebuttal' : null;
//     if (slot) (acc as any)[slot].push(r.text);
//   }
//   for (const r of aa) {
//     const t = (r.type || '').toLowerCase().replace('monological:', '');
//     const slot =
//       t === 'ground' || t === 'grounds' ? 'grounds' :
//       t === 'warrant'  ? 'warrant' :
//       t === 'backing'  ? 'backing' :
//       t === 'qualifier'? 'qualifier' :
//       t === 'rebuttal' ? 'rebuttal' : null;
//     if (slot) (acc as any)[slot].push(r.text);
//   }
//   for (const r of cw) acc.warrant.push(r.text);

//   return {
//     arg,
//     slots: {
//       claim:     uniq(acc.claim).slice(0,5),
//       grounds:   uniq(acc.grounds).slice(0,5),
//       warrant:   uniq(acc.warrant).slice(0,5),
//       backing:   uniq(acc.backing).slice(0,5),
//       qualifier: uniq(acc.qualifier).slice(0,5),
//       rebuttal:  uniq(acc.rebuttal).slice(0,5),
//     }
//   };
// }

// // --- bridge implementation -----------------------------------
// async function bridge(argumentId: string) {
//   const data = await gatherSlots(argumentId);
//   if (!data) return { ok:false, error:'argument not found' as const };

//   const { arg, slots } = data;
//   const deliberationId = arg.deliberationId;

//   // 1) ASSERT (only if already promoted)
//   let assertId: string | null = null;
//   if (arg.claimId) {
//     const move = await createMoveSafe({
//       deliberationId,
//       targetType:'claim',
//       targetId: arg.claimId,
//       kind:'ASSERT',
//       payload:{ note:'Bridged from monological' },
//       actorId:'Proponent',
//       signature: `bridge:${arg.id}:ASSERT:${arg.claimId}`
//     });
//     assertId = move?.id ?? null;
//   }

//   // 2) GROUNDS: grounds + backing (cap 3 each so we don’t spam)
//   const toGround: string[] = uniq([...(slots.grounds ?? []).slice(0,3), ...(slots.backing ?? []).slice(0,3)]);
//   const groundsMade: string[] = [];
//   for (const g of toGround) {
//     const move = await createMoveSafe({
//       deliberationId,
//       targetType:'argument',
//       targetId: arg.id,
//       kind:'GROUNDS',
//       payload:{ brief: g },
//       actorId:'Proponent',
//       signature: `bridge:${arg.id}:G:${sig(g)}`
//     });
//     if (move?.id) groundsMade.push(move.id);
//   }

//   // 3) WHY from rebuttals (seed a challenge thread)
//   const whyMade: string[] = [];
//   for (const r of (slots.rebuttal ?? []).slice(0,2)) {
//     const move = await createMoveSafe({
//       deliberationId,
//       targetType:'argument',
//       targetId: arg.id,
//       kind:'WHY',
//       payload:{ note: r },
//       actorId:'Opponent',
//       signature: `bridge:${arg.id}:WHY:${sig(r)}`
//     });
//     if (move?.id) whyMade.push(move.id);
//   }

//   try {
//     (globalThis as any).meshBus?.emit?.('dialogue:moves:refresh', { deliberationId });
//   } catch {}

//   return { ok:true, created: { assertId, grounds: groundsMade.length, whys: whyMade.length } };
// }


// function pickConclusion(text: string) {
//   const sents = (text.match(/[^.!?]+[.!?]+/g) || [text]).map(t => t.trim()).filter(Boolean);
//   const last  = sents[sents.length - 1] || '';
//   const looksLikeRebuttal = /\b(unless|except when|however|but|nevertheless|still)\b/i.test(last);
//   return looksLikeRebuttal ? '' : last;
// }

// async function collectSlots(argumentId: string, claimId?: string | null) {
//   const [mp, aa, cw, dr] = await Promise.all([
//     prisma.missingPremise.findMany({
//       where: { targetType: 'argument', targetId: argumentId },
//       select: { premiseType: true, text: true },
//     }),
//     prisma.argumentAnnotation.findMany({
//       where: { targetType: 'argument', targetId: argumentId, type: { startsWith: 'monological:' } },
//       select: { type: true, text: true },
//     }),
//     claimId
//       ? prisma.claimWarrant.findMany({ where: { claimId }, select: { text: true } })
//       : Promise.resolve([] as { text: string }[]),
//     prisma.defaultRule.findMany({
//       where: { argumentId },
//       select: { id: true, role: true, antecedent: true, justification: true, consequent: true }
//     }),
//   ]);

//   const norm = { grounds: [] as string[], warrant: [] as string[], backing: [] as string[], qualifier: [] as string[], rebuttal: [] as string[] };

//   for (const r of mp) {
//     const t = (r.premiseType || '').toLowerCase();
//     const slot =
//       t === 'ground' || t === 'grounds' || t === 'premise' ? 'grounds' :
//       t === 'warrant'  ? 'warrant'  :
//       t === 'backing'  ? 'backing'  :
//       t === 'qualifier'? 'qualifier':
//       t === 'rebuttal' ? 'rebuttal' : null;
//     if (slot) norm[slot].push(r.text);
//   }

//   for (const r of aa) {
//     const t = (r.type || '').toLowerCase().replace('monological:', '');
//     const slot =
//       t === 'ground' || t === 'grounds' ? 'grounds' :
//       t === 'warrant'  ? 'warrant'  :
//       t === 'backing'  ? 'backing'  :
//       t === 'qualifier'? 'qualifier':
//       t === 'rebuttal' ? 'rebuttal' : null;
//     if (slot) norm[slot].push(r.text);
//   }

//   for (const r of cw) norm.warrant.push(r.text);

//   return { slots: norm, defaults: dr };
// }

// // --- HTTP -----------------------------------------------------


// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json().catch(()=> ({}));
//     const argumentId: string | undefined = body?.argumentId;
//     const intent: Intent = (body?.intent === 'explain' ? 'explain' : 'justify');

//     if (!argumentId) return NextResponse.json({ error: 'argumentId required' }, { status: 400 });

//     const arg = await prisma.argument.findUnique({
//       where: { id: argumentId },
//       select: { id: true, text: true, claimId: true, deliberationId: true },
//     });
//     if (!arg) return NextResponse.json({ error: 'Argument not found' }, { status: 404 });

//     const { slots, defaults } = await collectSlots(argumentId, arg.claimId);

//     // Build a small move factory (adjust model names if yours differ)
//     // Assumes prisma.dialogueMove + prisma.dialogueEdge — if your schema names differ, rename below.
//     const moves: { id: string; }[] = [];
//     const created: Record<string, any> = {};

//     // helpers
//     const createMove = async (type: string, text: string, meta?: any) => {
//       const m = await prisma.dialogueMove.create({
//         data: {
//           deliberationId: arg.deliberationId || '',
//           id: argumentId,
//            type,          // e.g., 'ASSERT', 'WHY', 'GROUNDS', 'EXPLAIN', 'SUPPOSE', 'UNLESS', 'THEREFORE'
//           text: text.trim(),
//           meta: meta ? (meta as any) : undefined,
//         },
//         select: { id: true }
//       });
//       moves.push(m);
//       return m.id;
//     };
//     const link = (fromId: string, toId: string, type: string) =>
//       prisma.dialogueEdge.create({
//         data: {
//           deliberationId: arg.deliberationId || '',
//           fromMoveId: fromId,
//           toMoveId: toId,
//           type, // e.g., 'follows', 'supports', 'attacks'
//         }
//       });

//     // conclusion (heuristic if not promoted)
//     const conclusion = pickConclusion(arg.text || '');

//     if (intent === 'justify') {
//       // ASSERT + WHY + GROUNDS (+ WARRANT/BACKING/QUALIFIER/REBUTTAL if present)
//       const assertId = await createMove('ASSERT', conclusion || arg.text || '(claim)');
//       const whyId    = await createMove('WHY', 'Why believe that?');
//       await link(assertId, whyId, 'elicits');

//       for (const g of (slots.grounds || [])) {
//         const gid = await createMove('GROUNDS', g);
//         await link(gid, assertId, 'supports');
//       }
//       for (const w of (slots.warrant || [])) {
//         const wid = await createMove('WARRANT', w);
//         await link(wid, assertId, 'licenses');
//       }
//       for (const b of (slots.backing || [])) {
//         const bid = await createMove('BACKING', b);
//         await link(bid, assertId, 'supports');
//       }
//       for (const q of (slots.qualifier || [])) {
//         const qid = await createMove('QUALIFIER', q);
//         await link(qid, assertId, 'modulates');
//       }
//       for (const r of (slots.rebuttal || [])) {
//         const rid = await createMove('REBUTTAL', r);
//         await link(rid, assertId, 'attacks');
//       }
//     } else {
//       // intent === 'explain'
//       // EXPLAIN (explanandum) + BECAUSE (explanans)... treat grounds as explanans
//       const explanandum = conclusion || arg.text || '(phenomenon)';
//       const explainId   = await createMove('EXPLAIN', explanandum, { pragma: 'explanation' });

//       for (const g of (slots.grounds || [])) {
//         const becauseId = await createMove('BECAUSE', g, { pragma: 'explanation' });
//         await link(becauseId, explainId, 'explains');
//       }
//       // A warrant in explanation often reads as a generalization/causal law
//       for (const w of (slots.warrant || [])) {
//         const lawId = await createMove('LAW', w, { pragma: 'explanation' });
//         await link(lawId, explainId, 'underpins');
//       }
//     }

//     // B) SUPPOSE blocks from default rules (enthymemes): α : β / γ → SUPPOSE α ; UNLESS ¬β ; THEREFORE γ
//     for (const d of (defaults || [])) {
//       const a = (d.antecedent || '').trim();
//       const j = (d.justification || '').trim();
//       const c = (d.consequent || '').trim();
//       if (!a && !c) continue;

//       const supposeId   = a ? await createMove('SUPPOSE', a) : undefined;
//       const unlessId    = j ? await createMove('UNLESS', `not(${j})`) : undefined; // meta-negation for UI
//       const thereforeId = c ? await createMove('THEREFORE', c) : undefined;

//       if (supposeId && thereforeId) await link(supposeId, thereforeId, 'licenses');
//       if (unlessId  && thereforeId) await link(unlessId, thereforeId, 'blocks');
//     }

//     // Optional: attackSubtype → move names (undermine / rebut / undercut / overcut)
//     // If the client sends an attackSubtype, encode it in the move type for clarity:
//     const attackSubtype = body?.attackSubtype as ('undermine'|'rebut'|'undercut'|'overcut'|undefined);
//     if (attackSubtype) {
//       await createMove(`ATTACK:${attackSubtype.toUpperCase()}`, '', { attackSubtype });
//     }

//     return NextResponse.json({ ok: true, created: moves.length });
//   } catch (e: any) {
//     console.error('[monological:bridge]', e);
//     return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
//   }
// }
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { createDialogueMove } from '@/lib/ludics/createDialogueMove';
import { getCurrentUserId } from '@/lib/serverutils';
import { createHash } from 'crypto';

// tiny helpers
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

function sig(deliberationId: string, argumentId: string, kind: string, payload: any) {
  const h = createHash('sha256').update(JSON.stringify(payload || {})).digest('hex').slice(0, 12);
  return `bridge:${deliberationId}:${argumentId}:${kind}:${h}`;
}

type Mode = 'argument' | 'explanation';

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const argumentId = String(body?.argumentId || '');
  const mode: Mode = body?.mode === 'explanation' ? 'explanation' : 'argument';
  if (!argumentId) return NextResponse.json({ error: 'argumentId required' }, { status: 400 });

  // Pull the argument and context we need
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: { id: true, deliberationId: true, text: true, claimId: true },
  });
  if (!arg) return NextResponse.json({ error: 'Argument not found' }, { status: 404 });

  // 1) Canonical monological slots from stores we use elsewhere
  const mp = await prisma.missingPremise.findMany({
    where: { targetType: 'argument', targetId: argumentId },
    select: { premiseType: true, text: true },
  });

  const aa = await prisma.argumentAnnotation.findMany({
    where: { targetType: 'argument', targetId: argumentId, type: { startsWith: 'monological:' } },
    select: { type: true, text: true },
  });

  const cw = arg.claimId
    ? await prisma.claimWarrant.findMany({ where: { claimId: arg.claimId }, select: { text: true } })
    : [];

  const defaults = await prisma.defaultRule.findMany({
    where: { argumentId },
    select: { id: true, role: true, antecedent: true, justification: true, consequent: true, createdAt: true },
  });

  // fold stores into slots
  const acc: Record<'grounds' | 'warrant' | 'backing' | 'qualifier' | 'rebuttal', string[]> = {
    grounds: [], warrant: [], backing: [], qualifier: [], rebuttal: [],
  };

  for (const r of mp) {
    const t = (r.premiseType || '').toLowerCase();
    const slot =
      t === 'ground' || t === 'grounds' || t === 'premise' ? 'grounds' :
        t === 'warrant' ? 'warrant' :
          t === 'backing' ? 'backing' :
            t === 'qualifier' ? 'qualifier' :
              t === 'rebuttal' ? 'rebuttal' : null;
    if (slot) acc[slot].push(r.text);
  }

  for (const r of aa) {
    const t = (r.type || '').toLowerCase().replace('monological:', '');
    const slot =
      t === 'ground' || t === 'grounds' ? 'grounds' :
        t === 'warrant' ? 'warrant' :
          t === 'backing' ? 'backing' :
            t === 'qualifier' ? 'qualifier' :
              t === 'rebuttal' ? 'rebuttal' : null;
    if (slot) acc[slot].push(r.text);
  }

  for (const r of cw) acc.warrant.push(r.text);

  const slots = {
    grounds: uniq(acc.grounds).slice(0, 5),
    warrant: uniq(acc.warrant).slice(0, 5),
    backing: uniq(acc.backing).slice(0, 5),
    qualifier: uniq(acc.qualifier).slice(0, 5),
    rebuttal: uniq(acc.rebuttal).slice(0, 5),
  };

  // 2) Heuristic conclusion (last sentence bias if needed)
  const sentSplit = (txt: string) => (txt.match(/[^.!?]+[.!?]+/g) || [txt]).map(t => t.trim()).filter(Boolean);
  const sents = sentSplit(arg.text || '');
  const last = sents[sents.length - 1] || '';
  const rebuttalCue = /\b(unless|except when|however|but|on the other hand|still|nevertheless)\b/i;
  const conclusion = (rebuttalCue.test(last) ? '' : last) || sents[0] || arg.text || '';

  // 3) Synthesize dialogue moves
  const movesToUpsert: Array<{
    where: { signature: string };
    update: Record<string, never>;
    create: any;
  }> = [];

  const common = {
    deliberationId: arg.deliberationId,
    targetType: 'argument' as const,
    targetId: arg.id,
    actorId: String(userId),
  };

  // ASSERT – the conclusion or fall back to full text
  {
    const payload = { text: conclusion || arg.text, claimId: arg.claimId ?? null };
    movesToUpsert.push({
      where: { signature: sig(arg.deliberationId, arg.id, 'ASSERT', payload) },
      update: {},
      create: {
        ...common,
        kind: 'ASSERT',
        payload,
        signature: sig(arg.deliberationId, arg.id, 'ASSERT', payload),
      },
    });
  }

  // WHY vs EXPLAIN (pragmatics toggle)
  {
    const kind = mode === 'explanation' ? 'EXPLAIN' : 'WHY';
    const payload = { mode };
    movesToUpsert.push({
      where: { signature: sig(arg.deliberationId, arg.id, kind, payload) },
      update: {},
      create: {
        ...common,
        kind,
        payload,
        signature: sig(arg.deliberationId, arg.id, kind, payload),
      },
    });
  }

  // GROUNDS / BECAUSE (based on mode)
  {
    const kind = mode === 'explanation' ? 'BECAUSE' : 'GROUNDS';
    const grounds = uniq([...(slots.grounds || []), ...(slots.backing || [])]).slice(0, 6);
    for (const g of grounds) {
      const payload = { text: g };
      movesToUpsert.push({
        where: { signature: sig(arg.deliberationId, arg.id, kind, payload) },
        update: {},
        create: {
          ...common,
          kind,
          payload,
          signature: sig(arg.deliberationId, arg.id, kind, payload),
        },
      });
    }
  }

  // SUPPOSE / UNLESS / THEREFORE blocks from DefaultRule
  for (const r of defaults.filter(d => (d.role || '').toLowerCase() === 'premise')) {
    const rulePayload = {
      defaultRuleId: r.id,
      rule: { alpha: r.antecedent, beta: r.justification, gamma: r.consequent },
    };

    // SUPPOSE α
    movesToUpsert.push({
      where: { signature: sig(arg.deliberationId, arg.id, 'SUPPOSE', { id: r.id, a: r.antecedent }) },
      update: {},
      create: {
        ...common,
        kind: 'SUPPOSE',
        payload: { defaultRuleId: r.id, text: r.antecedent },
        signature: sig(arg.deliberationId, arg.id, 'SUPPOSE', { id: r.id, a: r.antecedent }),
      },
    });

    // UNLESS β (optional)
    if ((r.justification || '').trim()) {
      movesToUpsert.push({
        where: { signature: sig(arg.deliberationId, arg.id, 'UNLESS', { id: r.id, b: r.justification }) },
        update: {},
        create: {
          ...common,
          kind: 'UNLESS',
          payload: { defaultRuleId: r.id, text: r.justification },
          signature: sig(arg.deliberationId, arg.id, 'UNLESS', { id: r.id, b: r.justification }),
        },
      });
    }

    // THEREFORE γ
    if ((r.consequent || '').trim()) {
      movesToUpsert.push({
        where: { signature: sig(arg.deliberationId, arg.id, 'THEREFORE', { id: r.id, c: r.consequent }) },
        update: {},
        create: {
          ...common,
          kind: 'THEREFORE',
          payload: { defaultRuleId: r.id, text: r.consequent, rule: rulePayload.rule },
          signature: sig(arg.deliberationId, arg.id, 'THEREFORE', { id: r.id, c: r.consequent }),
        },
      });
    }
  }

  // REBUTTALs as REBUT moves
  for (const r of slots.rebuttal) {
    const payload = { text: r };
    movesToUpsert.push({
      where: { signature: sig(arg.deliberationId, arg.id, 'REBUT', payload) },
      update: {},
      create: {
        ...common,
        kind: 'REBUT',
        payload,
        signature: sig(arg.deliberationId, arg.id, 'REBUT', payload),
      },
    });
  }

  // Emit moves keyed by attackSubtype on edges touching this argument
  const edges = await prisma.argumentEdge.findMany({
    where: {
      OR: [{ fromArgumentId: arg.id }, { toArgumentId: arg.id }],
    },
    select: { id: true, type: true, attackSubtype: true, fromArgumentId: true, toArgumentId: true },
  });

  for (const e of edges) {
    const kind =
      e.attackSubtype ??
      (e.type === 'rebut' ? 'REBUT' : e.type === 'undercut' ? 'UNDERCUT' : e.type === 'support' ? 'SUPPORT_ATTACK' : 'SUPPORT');
    const payload = { edgeId: e.id, from: e.fromArgumentId, to: e.toArgumentId, baseType: e.type };
    movesToUpsert.push({
      where: { signature: sig(arg.deliberationId, arg.id, String(kind), payload) },
      update: {},
      create: {
        ...common,
        kind: String(kind),
        payload,
        signature: sig(arg.deliberationId, arg.id, String(kind), payload),
      },
    });
  }

  // Perform idempotent creates via the H1 seam (one transactional write
  // per move; the seam dedupes on (deliberationId, signature) using P2002).
  let createdCount = 0;
  for (const cfg of movesToUpsert) {
    const data = cfg.create as any;
    const seamResult = await createDialogueMove({
      deliberationId: data.deliberationId,
      targetType: data.targetType,
      targetId: data.targetId,
      kind: data.kind,
      actorId: data.actorId,
      signature: data.signature,
      payload: data.payload,
    });
    if (!seamResult.deduplicated) createdCount++;
  }

  return NextResponse.json({ ok: true, mode, created: createdCount });
}

// Keep GET for callers that were using a querystring (also fixes 405s from before)
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error:'Unauthorized' }, { status:401 });

  const argumentId = req.nextUrl.searchParams.get('argumentId') || '';
  if (!argumentId) return NextResponse.json({ ok:false, error:'argumentId required' }, { status:400 });

  // The legacy `bridge(argumentId)` helper was removed; bridging is now performed
  // by POST (which writes dialogue moves via the H1 seam). GET no longer mutates;
  // callers should POST { argumentId } instead.
  return NextResponse.json(
    { ok:false, error:'Use POST { argumentId } to bridge; GET is deprecated.' },
    { status:405 },
  );
}
