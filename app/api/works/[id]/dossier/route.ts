// // app/api/works/[id]/dossier/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prismaclient';

// export const dynamic = 'force-dynamic';

// function fwdAuth(req: NextRequest) {
//   const h = new Headers();
//   const cookie = req.headers.get('cookie'); if (cookie) h.set('cookie', cookie);
//   const auth = req.headers.get('authorization'); if (auth) h.set('authorization', auth);
//   h.set('cache-control', 'no-store');
//   return h;
// }

// async function assembleJson(req: NextRequest, workId: string) {
//   const w = await prisma.theoryWork.findUnique({
//     where: { id: workId },
//     select: {
//       id: true, slug: true, title: true, summary: true, body: true,
//       theoryType: true, standardOutput: true, authorId: true, deliberationId: true,
//       status: true, visibility: true, createdAt: true, updatedAt: true, publishedAt: true,
//       hermeneuticProject: true, practicalJustification: true, pascalModel: true,
//       dnStructure: true, ihTheses: true, tcTheses: true, opTheses: true,
//     },
//   });
//   if (!w) return { error: 'not_found' };

//   // edges: work | claims | all — default all
//   const delibId = w.deliberationId;
//   const claimsInDelib = delibId
//     ? await prisma.claim.findMany({ where: { deliberationId: delibId }, select: { id: true, text: true } })
//     : [];

//   const edges = await prisma.knowledgeEdge.findMany({
//     where: {
//       OR: [
//         { toWorkId: workId }, { fromWorkId: workId },
//         { toClaimId: { in: claimsInDelib.map(c => c.id) } },
//       ],
//     },
//     orderBy: { createdAt: 'desc' },
//   });

//   // integrity snapshot (reuses your existing route)
//   const integrityRes = await fetch(new URL(`/api/works/${workId}/integrity`, req.url), { headers: fwdAuth(req) });
//   const integrity = integrityRes.ok ? await integrityRes.json() : null;

//   return {
//     ok: true,
//     meta: {
//       id: w.id, slug: w.slug, title: w.title, theoryType: w.theoryType, summary: w.summary ?? null,
//       authorId: w.authorId, deliberationId: w.deliberationId, status: w.status, visibility: w.visibility,
//        standardOutput: w.standardOutput ?? null,
//       createdAt: w.createdAt, updatedAt: w.updatedAt, publishedAt: w.publishedAt ?? null,
//     },
//     body: w.body,
//     sections: {
//       dn: w.dnStructure ?? null,
//       ih: w.ihTheses ?? null,
//       tc: w.tcTheses ?? null,
//       op: w.opTheses ?? null,
//       hermeneuticProject: w.hermeneuticProject ?? null,
//       practicalJustification: w.practicalJustification ?? null,
//       pascalModel: w.pascalModel ?? null,
//     },
//     edges: { edges, claims: claimsInDelib },
//     integrity,
//   };
// }


// export async function GET(req: NextRequest, { params }:{ params:{ id:string }}) {
//   const url = new URL(req.url);
//   const format = (url.searchParams.get('format') ?? 'md').toLowerCase();
//   const lens   = (url.searchParams.get('lens') ?? '').toLowerCase();

//   // const format = (req.nextUrl.searchParams.get('format') || 'md').toLowerCase();
//   const w = await prisma.theoryWork.findUnique({
//     where:{ id: params.id },
//     select:{
//       id:true, slug:true, title:true, theoryType:true, standardOutput:true, body:true,
//       hermeneuticProject:true, practicalJustification:true, pascalModel:true,
//       dnStructure:true, ihTheses:true, tcTheses:true, opTheses:true,
//       createdAt:true, publishedAt:true, authorId:true,
//     }
//   });
//   if (!w) return NextResponse.json({ error:'not found' }, { status:404 });

//     if (format === 'md' && lens === 'ih') {
//     const ih = w.ihTheses ?? {};
//     const H  = w.hermeneuticProject ?? {};
//     const PJ = w.practicalJustification ?? null;

//     // pick selected hermeneutic snippets
//     const byId = new Map<string,string>();
//     (Array.isArray(H.facts) ? H.facts : []).forEach((f:any)=> f?.id && byId.set(f.id, f.text));
//     (Array.isArray(H.hypotheses) ? H.hypotheses : []).forEach((h:any)=> h?.id && byId.set(h.id, h.text));
//     const sel = (Array.isArray(H.selectedIds) ? H.selectedIds : []).map((id:string)=>byId.get(id)).filter(Boolean).slice(0,5) as string[];

//     const best = (PJ?.result as any)?.bestOptionId;

//     const lines: string[] = [];
//     lines.push(`# ${w.title} — IH Summary`);
//     if (w.standardOutput) lines.push(`\n**Standard Output:** ${w.standardOutput}`);
//     if (ih.structure || ih.function || ih.objectivity) {
//       lines.push('\n## Theses');
//       if (ih.structure)   lines.push(`- **Structure:** ${ih.structure}`);
//       if (ih.function)    lines.push(`- **Function:** ${ih.function}`);
//       if (ih.objectivity) lines.push(`- **Objectivity:** ${ih.objectivity}`);
//     }
//     if (sel.length) {
//       lines.push('\n## Hermeneutic highlights');
//       for (const s of sel) lines.push(`- ${s}`);
//     }
//     if (best) {
//       lines.push('\n## Practical (MCDA)');
//       lines.push(`- Best option: **${best}**`);
//     }
//     return new NextResponse(lines.join('\n'), { headers: { 'content-type':'text/markdown; charset=utf-8' } });
//   }

//   if (format === 'json') {
//     const payload = {
//       kind: 'theory_work',
//       meta: {
//         id: w.id, slug: w.slug, title: w.title, theoryType: w.theoryType,
//         standardOutput: w.standardOutput ?? null,
//         authorId: w.authorId, createdAt: w.createdAt,
//       },
//       sections: {
//         dn: w.dnStructure ?? null,
//         ih: w.ihTheses ?? null,
//         tc: w.tcTheses ?? null,
//         op: w.opTheses ?? null,
//       },
//       hermeneuticProject: w.hermeneuticProject ?? null,
//       practicalJustification: w.practicalJustification ?? null,
//       pascalModel: w.pascalModel ?? null,
//       body: w.body || '',
//     };
//     return NextResponse.json(payload, {
//       headers: { 'Cache-Control':'no-store', 'Content-Type':'application/json' }
//     });
//   }


//   const lines:string[] = [];
//   lines.push(`# ${w.title}`);
//   lines.push(`_Type:_ **${w.theoryType}**`);
//   if (w.standardOutput) lines.push(`\n**Standard Output:** ${w.standardOutput}`);
//   lines.push('\n---\n## Body\n'); lines.push(w.body || '');

//   if (w.dnStructure) {
//     lines.push('\n---\n## DN — Structure');
//     if (w.dnStructure.explanandum)   lines.push(`- Explanandum: ${w.dnStructure.explanandum}`);
//     if (w.dnStructure.nomological)   lines.push(`- Laws: ${w.dnStructure.nomological}`);
//     if (w.dnStructure.ceterisParibus)lines.push(`- Ceteris paribus: ${w.dnStructure.ceterisParibus}`);
//   }
//   if (w.ihTheses) {
//     lines.push('\n---\n## IH — Structure / Function / Objectivity');
//     if (w.ihTheses.structure)   lines.push(`- Structure: ${w.ihTheses.structure}`);
//     if (w.ihTheses.function)    lines.push(`- Function: ${w.ihTheses.function}`);
//     if (w.ihTheses.objectivity) lines.push(`- Objectivity: ${w.ihTheses.objectivity}`);
//   }
//   if (w.tcTheses) {
//     lines.push('\n---\n## TC — Function / Explanation / Applications');
//     if (w.tcTheses.instrumentFunction) lines.push(`- Function: ${w.tcTheses.instrumentFunction}`);
//     if (w.tcTheses.explanation)        lines.push(`- Explanation: ${w.tcTheses.explanation}`);
//     if ((w.tcTheses.applications??[]).length) lines.push(`- Applications: ${(w.tcTheses.applications as string[]).join(', ')}`);
//   }
//   if (w.opTheses) {
//     lines.push('\n---\n## OP — Unrecognizability / Alternatives');
//     if (w.opTheses.unrecognizability) lines.push(`- Unrecognizability: ${w.opTheses.unrecognizability}`);
//     if ((w.opTheses.alternatives??[]).length) lines.push(`- Alternatives: ${(w.opTheses.alternatives as string[]).join(', ')}`);
//   }
//   if (w.hermeneuticProject) {
//     lines.push('\n---\n## Hermeneutic\n');
//     lines.push('```json'); lines.push(JSON.stringify(w.hermeneuticProject, null, 2)); lines.push('```');
//   }
//   if (w.practicalJustification) {
//     lines.push('\n---\n## Practical (MCDA)\n');
//     lines.push('```json'); lines.push(JSON.stringify(w.practicalJustification, null, 2)); lines.push('```');
//   }
//   if (w.pascalModel) {
//     lines.push('\n---\n## Pascal (Decision)\n');
//     lines.push('```json'); lines.push(JSON.stringify(w.pascalModel, null, 2)); lines.push('```');
//   }

//   const md = lines.join('\n');

//   if (format === 'pdf') {
//     // keep simple: return Markdown as text/plain for now or render server-side if you have a PDF lib
//     return new NextResponse(md, { headers:{ 'content-type':'text/markdown; charset=utf-8' }});
//   }
//   return new NextResponse(md, { headers:{ 'content-type':'text/markdown; charset=utf-8' }});
// }
// app/api/works/[id]/dossier/route.ts  (replace with this version)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest, { params }:{ params:{ id:string }}) {
  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'md').toLowerCase();
  const lens   = (url.searchParams.get('lens') ?? '').toLowerCase();

  const w = await prisma.theoryWork.findUnique({
    where:{ id: params.id },
    select:{
      id:true, title:true, theoryType:true, standardOutput:true, summary:true, body:true,
      createdAt:true, updatedAt:true, slug:true,
      dnStructure:true, ihTheses:true, tcTheses:true, opTheses:true,
      hermeneuticProject:true, practicalJustification:true, pascalModel:true,
    }
  });
  if (!w) return NextResponse.json({ error:'not found' }, { status:404 });

  // ---------- JSON lens ----------
  if (format === 'json') {
    const json = {
      kind: 'theory_work',
      meta: {
        id: w.id, slug: w.slug, title: w.title, theoryType: w.theoryType,
        standardOutput: w.standardOutput, createdAt: w.createdAt, updatedAt: w.updatedAt,
      },
      summary: w.summary ?? null,
      body: w.body ?? '',
      sections: {
        dn: w.dnStructure ?? null,
        ih: w.ihTheses ?? null,
        tc: w.tcTheses ?? null,
        op: w.opTheses ?? null,
      },
      hermeneutic: w.hermeneuticProject ?? null,
      practical: w.practicalJustification ?? null,
      pascal: w.pascalModel ?? null,
    };
    return NextResponse.json(json, { headers: { 'Cache-Control':'no-store' } });
  }

  // ---------- IH export lens (Markdown) ----------
  if (format === 'md' && lens === 'ih' && w.theoryType === 'IH') {
    const ih = (w.ihTheses ?? {}) as any;
    const H  = w.hermeneuticProject ?? {};
    const PJ = w.practicalJustification ?? null;

    const byId = new Map<string,string>();
    (Array.isArray((H as any).facts) ? (H as any).facts : []).forEach((f:any)=> f?.id && byId.set(f.id, f.text));
    (Array.isArray((H as any).hypotheses) ? (H as any).hypotheses : []).forEach((h:any)=> h?.id && byId.set(h.id, h.text));
    const sel = (Array.isArray((H as any).selectedIds) ? (H as any).selectedIds : []).map((id:string)=>byId.get(id)).filter(Boolean).slice(0,5) as string[];
    const best = (PJ?.result as any)?.bestOptionId;

    const lines:string[] = [];
    lines.push(`# ${w.title} — IH Summary`);
    if (w.standardOutput) lines.push(`\n**Standard Output:** ${w.standardOutput}`);
    if (ih.structure || ih.function || ih.objectivity) {
      lines.push('\n## Theses');
      if (ih.structure)   lines.push(`- **Structure:** ${ih.structure}`);
      if (ih.function)    lines.push(`- **Function:** ${ih.function}`);
      if (ih.objectivity) lines.push(`- **Objectivity:** ${ih.objectivity}`);
    }
    if (sel.length) {
      lines.push('\n## Hermeneutic highlights');
      for (const s of sel) lines.push(`- ${s}`);
    }
    if (best) {
      lines.push('\n## Practical (MCDA)');
      lines.push(`- Best option: **${best}**`);
    }
    return new NextResponse(lines.join('\n'), { headers: { 'content-type':'text/markdown; charset=utf-8' }});
  }

  // ---------- Default Markdown ----------
  const lines:string[] = [];
  lines.push(`# ${w.title}`);
  lines.push(`_Type:_ **${w.theoryType}**`);
  if (w.standardOutput) lines.push(`\n**Standard Output:** ${w.standardOutput}`);
  if (w.summary) lines.push('\n---\n## Abstract\n', w.summary);
  if (w.body)    lines.push('\n---\n## Body\n', w.body);

  if (w.dnStructure) {
    lines.push('\n---\n## DN — Structure');
    if (w.dnStructure.explanandum)   lines.push(`- Explanandum: ${w.dnStructure.explanandum}`);
    if (w.dnStructure.nomological)   lines.push(`- Laws: ${w.dnStructure.nomological}`);
    if (w.dnStructure.ceterisParibus)lines.push(`- Ceteris paribus: ${w.dnStructure.ceterisParibus}`);
  }
  if (w.ihTheses) {
    lines.push('\n---\n## IH — Structure / Function / Objectivity');
    if (w.ihTheses.structure)   lines.push(`- Structure: ${w.ihTheses.structure}`);
    if (w.ihTheses.function)    lines.push(`- Function: ${w.ihTheses.function}`);
    if (w.ihTheses.objectivity) lines.push(`- Objectivity: ${w.ihTheses.objectivity}`);
  }
  if (w.tcTheses) {
    lines.push('\n---\n## TC — Function / Explanation / Applications');
    if (w.tcTheses.instrumentFunction) lines.push(`- Function: ${w.tcTheses.instrumentFunction}`);
    if (w.tcTheses.explanation)        lines.push(`- Explanation: ${w.tcTheses.explanation}`);
    if ((w.tcTheses.applications??[]).length) lines.push(`- Applications: ${(w.tcTheses.applications as string[]).join(', ')}`);
  }
  if (w.opTheses) {
    lines.push('\n---\n## OP — Unrecognizability / Alternatives');
    if (w.opTheses.unrecognizability) lines.push(`- Unrecognizability: ${w.opTheses.unrecognizability}`);
    if ((w.opTheses.alternatives??[]).length) lines.push(`- Alternatives: ${(w.opTheses.alternatives as string[]).join(', ')}`);
  }
  if (w.hermeneuticProject) {
    lines.push('\n---\n## Hermeneutic\n');
    lines.push('```json'); lines.push(JSON.stringify(w.hermeneuticProject, null, 2)); lines.push('```');
  }
  if (w.practicalJustification) {
    lines.push('\n---\n## Practical (MCDA)\n');
    lines.push('```json'); lines.push(JSON.stringify(w.practicalJustification, null, 2)); lines.push('```');
  }
  if (w.pascalModel) {
    lines.push('\n---\n## Pascal (Decision)\n');
    lines.push('```json'); lines.push(JSON.stringify(w.pascalModel, null, 2)); lines.push('```');
  }

  const md = lines.join('\n');
  return new NextResponse(md, { headers:{ 'content-type':'text/markdown; charset=utf-8' }});
}
