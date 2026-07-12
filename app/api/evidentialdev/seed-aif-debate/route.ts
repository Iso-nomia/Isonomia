// // app/api/evidentialdev/seed-aif-debate/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prismaclient';
// import type { StatementRole, InferenceKind, EdgeType, TargetScope } from '@prisma/client';

// export const dynamic = 'force-dynamic';
// export const revalidate = 0;
// const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

// const uid = (n = 6) => Math.random().toString(36).slice(2, 2 + n);
// const moid = (tag: string) => `seed:${tag}:${Date.now()}:${uid(4)}`;
// const must = <T>(x: T | undefined | null, m: string): T => {
//   if (x === undefined || x === null) throw new Error(m);
//   return x;
// };

// export async function GET() {
//   return NextResponse.json({ ok: true }, NO_STORE);
// }

// export async function POST(_req: NextRequest) {
//   try {
//     const result = await prisma.$transaction(async (db) => {
//       // ==================== 0) Setup: Room + Deliberation ====================
//       const room = await db.agoraRoom.create({
//         data: {
//           slug: `bike-lanes-${Date.now()}-${uid(3)}`,
//           title: 'Protected Bike Lanes on Maple Avenue',
//           summary: 'Should the city install protected bike lanes on Maple Ave?',
//         },
//         select: { id: true, slug: true, title: true },
//       });

//       // Create deliberation (keep it simple & typed)
//       const delib = await db.deliberation.create({
//         data: {
//           hostType: 'post',          // any of: article|post|room_thread|library_stack|site|inbox_thread
//           hostId: `topic:${uid(6)}`,
//           createdById: 'system',
//           rule: 'utilitarian',       // RepresentationRule
//           roomId: room.id,           // link for convenience
//           agoraRoomId: room.id,      // optional: keep both if you use both in your app
//         },
//         select: { id: true },
//       });
//       const deliberationId = delib.id;

//       // ==================== 1) Claims ====================
//       const [mainClaim, safetyClaim, trafficClaim, costClaim] = await Promise.all([
//         db.claim.create({
//           data: {
//             deliberationId,
//             text: 'The city should install protected bike lanes on Maple Avenue',
//             createdById: 'system',
//             moid: moid('main-claim'),
//           },
//           select: { id: true, text: true },
//         }),
//         db.claim.create({
//           data: {
//             deliberationId,
//             text: 'Protected bike lanes significantly improve cyclist safety',
//             createdById: 'system',
//             moid: moid('safety-claim'),
//           },
//           select: { id: true, text: true },
//         }),
//         db.claim.create({
//           data: {
//             deliberationId,
//             text: 'Bike lanes will worsen traffic congestion',
//             createdById: 'system',
//             moid: moid('traffic-claim'),
//           },
//           select: { id: true, text: true },
//         }),
//         db.claim.create({
//           data: {
//             deliberationId,
//             text: 'The project cost is justified by long-term benefits',
//             createdById: 'system',
//             moid: moid('cost-claim'),
//           },
//           select: { id: true, text: true },
//         }),
//       ]);

//       // ==================== 2) Safety Argument (supporting main claim) ====================
//       const safetyArg = await db.argument.create({
//         data: {
//           deliberationId,
//           authorId: 'system',
//           text: 'Safety Argument: Protected lanes reduce injuries',
//           claimId: mainClaim.id, // “about” the main claim
//           // optionally also model the argument’s conclusion as a Claim row:
//           conclusionClaimId: mainClaim.id,
//           mediaType: 'text',
//         },
//         select: { id: true, text: true },
//       });

//       // Internal diagram: statements + inference(kind) + premises
//       const safetyDiagram = await db.argumentDiagram.create({
//         data: {
//           title: 'Safety Case for Protected Bike Lanes',
//           createdById: 'system',
//           statements: {
//             create: [
//               {
//                 text: 'Protected lanes reduce injuries by 40–50% in peer cities',
//                 role: 'premise' as StatementRole,
//                 tags: ['data', 'safety'],
//               },
//               {
//                 text: 'Maple Ave carries heavy bike and scooter traffic from two schools',
//                 role: 'premise' as StatementRole,
//                 tags: ['context', 'demand'],
//               },
//               {
//                 text: 'If an intervention reduces injuries and demand is high, the city ought to implement it',
//                 role: 'warrant' as StatementRole,
//                 tags: ['policy-principle'],
//               },
//               {
//                 text: 'The city should install protected bike lanes on Maple Avenue',
//                 role: 'conclusion' as StatementRole,
//                 tags: ['recommendation'],
//               },
//             ],
//           },
//         },
//         include: { statements: true },
//       });

//       const S = new Map<string, string>(
//         safetyDiagram.statements.map((s) => [s.text, s.id])
//       );

//       const safetyInf = await db.inference.create({
//         data: {
//           diagramId: safetyDiagram.id,
//           kind: 'presumptive' as InferenceKind,             // enum per schema
//           conclusionId: must(
//             S.get('The city should install protected bike lanes on Maple Avenue'),
//             'safety: missing conclusionId'
//           ),
//           schemeKey: 'value_based_pr',
//           cqKeys: [],                                       // String[]
//         },
//         select: { id: true },
//       });

//       await db.inferencePremise.createMany({
//         data: [
//           {
//             inferenceId: safetyInf.id,
//             statementId: must(
//               S.get('Protected lanes reduce injuries by 40–50% in peer cities'),
//               'safety: missing premise 1'
//             ),
//           },
//           {
//             inferenceId: safetyInf.id,
//             statementId: must(
//               S.get('Maple Ave carries heavy bike and scooter traffic from two schools'),
//               'safety: missing premise 2'
//             ),
//           },
//           {
//             inferenceId: safetyInf.id,
//             statementId: must(
//               S.get(
//                 'If an intervention reduces injuries and demand is high, the city ought to implement it'
//               ),
//               'safety: missing warrant'
//             ),
//           },
//         ],
//         skipDuplicates: true,
//       });

//       // ==================== 3) Traffic Opposition Argument ====================
//       const trafficArg = await db.argument.create({
//         data: {
//           deliberationId,
//           authorId: 'system',
//           text: 'Traffic Argument: Lanes will worsen congestion',
//           claimId: trafficClaim.id,
//           conclusionClaimId: trafficClaim.id,
//           mediaType: 'text',
//         },
//         select: { id: true, text: true },
//       });

//       const trafficDiagram = await db.argumentDiagram.create({
//         data: {
//           title: 'Traffic Congestion Concerns',
//           createdById: 'system',
//           statements: {
//             create: [
//               {
//                 text: 'Removing one car lane will reduce vehicle capacity',
//                 role: 'premise' as StatementRole,
//                 tags: ['traffic'],
//               },
//               {
//                 text: 'Maple Ave is already congested during peak hours',
//                 role: 'premise' as StatementRole,
//                 tags: ['context'],
//               },
//               {
//                 text: 'Reduced capacity on congested roads increases delays',
//                 role: 'warrant' as StatementRole,
//                 tags: ['traffic-principle'],
//               },
//               {
//                 text: 'Bike lanes will worsen traffic congestion',
//                 role: 'conclusion' as StatementRole,
//                 tags: ['prediction'],
//               },
//             ],
//           },
//         },
//         include: { statements: true },
//       });

//       const T = new Map<string, string>(
//         trafficDiagram.statements.map((s) => [s.text, s.id])
//       );

//       const trafficInf = await db.inference.create({
//         data: {
//           diagramId: trafficDiagram.id,
//           kind: 'inductive' as InferenceKind,               // causal = inductive
//           conclusionId: must(
//             T.get('Bike lanes will worsen traffic congestion'),
//             'traffic: missing conclusionId'
//           ),
//           schemeKey: 'cause_to_effect',
//           cqKeys: [],
//         },
//         select: { id: true },
//       });

//       await db.inferencePremise.createMany({
//         data: [
//           {
//             inferenceId: trafficInf.id,
//             statementId: must(
//               T.get('Removing one car lane will reduce vehicle capacity'),
//               'traffic: missing premise 1'
//             ),
//           },
//           {
//             inferenceId: trafficInf.id,
//             statementId: must(
//               T.get('Maple Ave is already congested during peak hours'),
//               'traffic: missing premise 2'
//             ),
//           },
//           {
//             inferenceId: trafficInf.id,
//             statementId: must(
//               T.get('Reduced capacity on congested roads increases delays'),
//               'traffic: missing warrant'
//             ),
//           },
//         ],
//         skipDuplicates: true,
//       });

//       // ==================== 4) Counter‑argument: Modal Shift (undercuts traffic inference) ====================
//       const modalArg = await db.argument.create({
//         data: {
//           deliberationId,
//           authorId: 'system',
//           text: 'Modal Shift Response: More biking reduces car traffic',
//           claimId: mainClaim.id,
//           // this argument’s conclusion is *not* the main claim; it’s a causal claim about congestion
//           conclusionClaimId: (
//             await db.claim.create({
//               data: {
//                 deliberationId,
//                 text: 'The net effect reduces congestion rather than increasing it',
//                 createdById: 'system',
//                 moid: moid('modal-concl'),
//               },
//               select: { id: true },
//             })
//           ).id,
//           mediaType: 'text',
//         },
//         select: { id: true, conclusionClaimId: true, text: true },
//       });

//       const modalDiagram = await db.argumentDiagram.create({
//         data: {
//           title: 'Modal Shift Counterargument',
//           createdById: 'system',
//           statements: {
//             create: [
//               {
//                 text: 'Protected lanes increase cycling by 50–75% (Seattle, Portland data)',
//                 role: 'premise' as StatementRole,
//                 tags: ['data'],
//               },
//               {
//                 text: 'Each new cyclist is one less car on the road',
//                 role: 'premise' as StatementRole,
//                 tags: ['modal-shift'],
//               },
//               {
//                 text: 'The net effect reduces congestion rather than increasing it',
//                 role: 'conclusion' as StatementRole,
//                 tags: ['rebuttal'],
//               },
//             ],
//           },
//         },
//         include: { statements: true },
//       });

//       const M = new Map<string, string>(
//         modalDiagram.statements.map((s) => [s.text, s.id])
//       );

//       const modalInf = await db.inference.create({
//         data: {
//           diagramId: modalDiagram.id,
//           kind: 'inductive' as InferenceKind,
//           conclusionId: must(
//             M.get('The net effect reduces congestion rather than increasing it'),
//             'modal: missing conclusionId'
//           ),
//           schemeKey: 'cause_to_effect',
//           cqKeys: [],
//         },
//         select: { id: true },
//       });

//       await db.inferencePremise.createMany({
//         data: [
//           {
//             inferenceId: modalInf.id,
//             statementId: must(
//               M.get('Protected lanes increase cycling by 50–75% (Seattle, Portland data)'),
//               'modal: missing premise 1'
//             ),
//           },
//           {
//             inferenceId: modalInf.id,
//             statementId: must(
//               M.get('Each new cyclist is one less car on the road'),
//               'modal: missing premise 2'
//             ),
//           },
//         ],
//         skipDuplicates: true,
//       });

//       // ==================== 5) Expert Opinion (supports main claim) ====================
//       const expertArg = await db.argument.create({
//         data: {
//           deliberationId,
//           authorId: 'system',
//           text: 'Expert Opinion: Transportation planners support the project',
//           claimId: mainClaim.id,
//           conclusionClaimId: mainClaim.id,
//           mediaType: 'text',
//         },
//         select: { id: true, text: true },
//       });

//       const expertDiagram = await db.argumentDiagram.create({
//         data: {
//           title: 'Expert Opinion Support',
//           createdById: 'system',
//           statements: {
//             create: [
//               {
//                 text: 'City Transportation Department recommends protected lanes for Maple Ave',
//                 role: 'premise' as StatementRole,
//                 tags: ['expert'],
//               },
//               {
//                 text: 'Transportation planners are experts in urban mobility',
//                 role: 'premise' as StatementRole,
//                 tags: ['credibility'],
//               },
//               {
//                 text: 'We should follow expert recommendations on technical matters',
//                 role: 'warrant' as StatementRole,
//                 tags: ['epistemic'],
//               },
//               {
//                 text: 'The city should install protected bike lanes on Maple Avenue',
//                 role: 'conclusion' as StatementRole,
//                 tags: ['recommendation'],
//               },
//             ],
//           },
//         },
//         include: { statements: true },
//       });

//       const E = new Map<string, string>(
//         expertDiagram.statements.map((s) => [s.text, s.id])
//       );

//       const expertInf = await db.inference.create({
//         data: {
//           diagramId: expertDiagram.id,
//           kind: 'presumptive' as InferenceKind,
//           conclusionId: must(
//             E.get('The city should install protected bike lanes on Maple Avenue'),
//             'expert: missing conclusionId'
//           ),
//           schemeKey: 'argument_from_expert_opinion',
//           // NOTE: use double quotes to avoid breaking the parser on "expert's"
//           cqKeys: [
//             'CQ1: Is the source a genuine expert?',
//             "CQ2: Is the expert's opinion relevant?",
//           ],
//         },
//         select: { id: true },
//       });

//       await db.inferencePremise.createMany({
//         data: [
//           {
//             inferenceId: expertInf.id,
//             statementId: must(
//               E.get('City Transportation Department recommends protected lanes for Maple Ave'),
//               'expert: missing premise 1'
//             ),
//           },
//           {
//             inferenceId: expertInf.id,
//             statementId: must(
//               E.get('Transportation planners are experts in urban mobility'),
//               'expert: missing premise 2'
//             ),
//           },
//           {
//             inferenceId: expertInf.id,
//             statementId: must(
//               E.get('We should follow expert recommendations on technical matters'),
//               'expert: missing warrant'
//             ),
//           },
//         ],
//         skipDuplicates: true,
//       });

//       // ==================== 6) Argument supports & attack edges ====================
//       await db.argumentSupport.createMany({
//         data: [
//           {
//             deliberationId,
//             claimId: mainClaim.id,
//             argumentId: safetyArg.id,
//             mode: 'product',
//             strength: 0.72,
//             base: 0.72,
//           },
//           {
//             deliberationId,
//             claimId: trafficClaim.id,
//             argumentId: trafficArg.id,
//             mode: 'product',
//             strength: 0.58,
//             base: 0.58,
//           },
//           {
//             deliberationId,
//             claimId: must(modalArg.conclusionClaimId, 'modal: missing conclusionClaimId'),
//             argumentId: modalArg.id,
//             mode: 'product',
//             strength: 0.65,
//             base: 0.65,
//           },
//           {
//             deliberationId,
//             claimId: mainClaim.id,
//             argumentId: expertArg.id,
//             mode: 'product',
//             strength: 0.68,
//             base: 0.68,
//           },
//         ],
//         skipDuplicates: true,
//       });

//       // modal shift UNDERCUTS the traffic inference (argument → argument)
//       await db.argumentEdge.create({
//         data: {
//           deliberationId,
//           fromArgumentId: modalArg.id,
//           toArgumentId: trafficArg.id,
//           type: 'undercut' as EdgeType,         // EdgeType enum
//           createdById: 'system',
//           targetScope: 'inference' as TargetScope,
//           attackType: 'UNDERCUTS',              // keep legacy AF field in sync
//         },
//       });

//       // (optional) traffic argument REBUTS the main claim’s conclusion (claim‑level)
//       // If you also want claim‑level attacks in your AF:
//       await db.claimEdge.create({
//         data: {
//           fromClaimId: trafficClaim.id,
//           toClaimId: mainClaim.id,
//           type: 'rebuts',
//           targetScope: 'conclusion',
//           deliberationId,
//           attackType: 'REBUTS',
//         },
//       });

//       // ==================== 7) DebateSheet (nodes wiring) ====================
//       const sheet = await db.debateSheet.create({
//         data: {
//           title: `Bike Lanes Debate • ${room.slug}`,
//           createdById: 'system',
//           deliberationId,
//           roomId: room.id,
//         },
//         select: { id: true },
//       });

//       await db.debateNode.createMany({
//         data: [
//           // claims
//           { sheetId: sheet.id, title: mainClaim.text, claimId: mainClaim.id },
//           { sheetId: sheet.id, title: safetyClaim.text, claimId: safetyClaim.id },
//           { sheetId: sheet.id, title: trafficClaim.text, claimId: trafficClaim.id },
//           { sheetId: sheet.id, title: costClaim.text, claimId: costClaim.id },
//           // arguments + diagrams
//           { sheetId: sheet.id, title: 'Safety Argument', argumentId: safetyArg.id, diagramId: safetyDiagram.id },
//           { sheetId: sheet.id, title: 'Traffic Argument', argumentId: trafficArg.id, diagramId: trafficDiagram.id },
//           { sheetId: sheet.id, title: 'Modal Shift', argumentId: modalArg.id, diagramId: modalDiagram.id },
//           { sheetId: sheet.id, title: 'Expert Opinion', argumentId: expertArg.id, diagramId: expertDiagram.id },
//         ],
//         skipDuplicates: true,
//       });

//       return {
//         room,
//         deliberationId,
//         sheetId: sheet.id,
//         claims: { main: mainClaim.id, safety: safetyClaim.id, traffic: trafficClaim.id, cost: costClaim.id },
//         args: {
//           safety: { id: safetyArg.id, diagramId: safetyDiagram.id },
//           traffic: { id: trafficArg.id, diagramId: trafficDiagram.id },
//           modal: { id: modalArg.id, diagramId: modalDiagram.id },
//           expert: { id: expertArg.id, diagramId: expertDiagram.id },
//         },
//       };
//     });

//     return NextResponse.json(
//       {
//         ok: true,
//         room: result.room,
//         deliberationId: result.deliberationId,
//         sheetId: result.sheetId,
//         urls: {
//           room: `/agora/rooms/${result.room.slug}`,
//           deliberation: `/deliberation/${result.deliberationId}`,
//           sheet: `/api/sheets/${result.sheetId}`,
//           sheetAlias: `/api/sheets/delib:${result.deliberationId}`,
//           evidential: `/api/deliberations/${result.deliberationId}/evidential?mode=product`,
//           evidentialMin: `/api/deliberations/${result.deliberationId}/evidential?mode=min`,
//           graph: `/api/deliberations/${result.deliberationId}/graph?semantics=preferred&confidence=0.6&mode=product`,
//         },
//         created: { claims: result.claims, arguments: result.args },
//         summary: {
//           scenario: 'Protected bike lanes debate with 4 claims, 4 arguments, all diagrammed',
//           features: [
//             'Safety argument (presumptive practical reasoning)',
//             'Traffic opposition (inductive/causal)',
//             'Modal shift counter-argument (undercut on inference)',
//             'Expert opinion (presumptive scheme)',
//           ],
//         },
//       },
//       NO_STORE
//     );
//   } catch (err: any) {
//     return NextResponse.json(
//       { ok: false, error: String(err?.message || err) },
//       { status: 500, ...NO_STORE }
//     );
//   }
// }
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import type { StatementRole, InferenceKind, EdgeType, TargetScope } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

const uid = (n = 6) => Math.random().toString(36).slice(2, 2 + n);
const moid = (tag: string) => `seed:${tag}:${Date.now()}:${uid(4)}`;
const must = <T>(x: T | null | undefined, msg: string) => { if (x == null) throw new Error(msg); return x; };

export async function GET() { return NextResponse.json({ ok: true }, NO_STORE); }

export async function POST(_req: NextRequest) {
  try {
    // 0) Room + Deliberation
    const room = await prisma.agoraRoom.create({
      data: { slug: `bike-lanes-${Date.now()}-${uid(3)}`, title: 'Protected Bike Lanes on Maple Avenue',
              summary: 'Should the city install protected bike lanes on Maple Ave?' },
      select: { id: true, slug: true, title: true }
    });

    const { id: deliberationId } = await prisma.deliberation.create({
      data: {
        hostType: 'post',
        hostId: `topic:${uid(6)}`,
        createdById: 'system',
        rule: 'utilitarian',
        roomId: room.id,
        agoraRoomId: room.id,
      },
      select: { id: true }
    });

    // 1) Claims
    const [mainClaim, safetyClaim, trafficClaim, costClaim] = await Promise.all([
      prisma.claim.create({ data: { deliberationId, text: 'The city should install protected bike lanes on Maple Avenue',
        createdById: 'system', moid: moid('main') }, select: { id: true, text: true } }),
      prisma.claim.create({ data: { deliberationId, text: 'Protected bike lanes significantly improve cyclist safety',
        createdById: 'system', moid: moid('safety') }, select: { id: true, text: true } }),
      prisma.claim.create({ data: { deliberationId, text: 'Bike lanes will worsen traffic congestion',
        createdById: 'system', moid: moid('traffic') }, select: { id: true, text: true } }),
      prisma.claim.create({ data: { deliberationId, text: 'The project cost is justified by long-term benefits',
        createdById: 'system', moid: moid('cost') }, select: { id: true, text: true } }),
    ]);

    // 2) Safety (supports main)
    const safetyArg = await prisma.argument.create({
      data: { deliberationId, authorId: 'system', text: 'Safety Argument: Protected lanes reduce injuries',
              claimId: mainClaim.id, conclusionClaimId: mainClaim.id, mediaType: 'text' },
      select: { id: true, text: true }
    });

    const safetyDiagram = await prisma.argumentDiagram.create({
      data: {
        title: 'Safety Case for Protected Bike Lanes',
        createdById: 'system',
        statements: { create: [
          { text: 'Protected lanes reduce injuries by 40–50% in peer cities', role: 'premise', tags: ['data','safety'] },
          { text: 'Maple Ave carries heavy bike and scooter traffic from two schools', role: 'premise', tags: ['context','demand'] },
          { text: 'If an intervention reduces injuries and demand is high, the city ought to implement it', role: 'warrant', tags: ['policy-principle'] },
          { text: 'The city should install protected bike lanes on Maple Avenue', role: 'conclusion', tags: ['recommendation'] },
        ] }
      },
      include: { statements: true }
    });
    const S = new Map(safetyDiagram.statements.map(s => [s.text, s.id]));
    const safetyInf = await prisma.inference.create({
      data: {
        diagramId: safetyDiagram.id,
        kind: 'presumptive',
        conclusionId: must(S.get('The city should install protected bike lanes on Maple Avenue'), 'safety: missing conclusion'),
        schemeKey: 'value_based_pr',
        cqKeys: [],
      },
      select: { id: true }
    });
    await prisma.inferencePremise.createMany({
      data: [
        { inferenceId: safetyInf.id, statementId: must(S.get('Protected lanes reduce injuries by 40–50% in peer cities'), 'safety p1') },
        { inferenceId: safetyInf.id, statementId: must(S.get('Maple Ave carries heavy bike and scooter traffic from two schools'), 'safety p2') },
        { inferenceId: safetyInf.id, statementId: must(S.get('If an intervention reduces injuries and demand is high, the city ought to implement it'), 'safety warrant') },
      ], skipDuplicates: true
    });

    // 3) Traffic (opposes)
    const trafficArg = await prisma.argument.create({
      data: { deliberationId, authorId: 'system', text: 'Traffic Argument: Lanes will worsen congestion',
              claimId: trafficClaim.id, conclusionClaimId: trafficClaim.id, mediaType: 'text' },
      select: { id: true, text: true }
    });
    const trafficDiagram = await prisma.argumentDiagram.create({
      data: {
        title: 'Traffic Congestion Concerns',
        createdById: 'system',
        statements: { create: [
          { text: 'Removing one car lane will reduce vehicle capacity', role: 'premise', tags: ['traffic'] },
          { text: 'Maple Ave is already congested during peak hours', role: 'premise', tags: ['context'] },
          { text: 'Reduced capacity on congested roads increases delays', role: 'warrant', tags: ['traffic-principle'] },
          { text: 'Bike lanes will worsen traffic congestion', role: 'conclusion', tags: ['prediction'] },
        ] }
      },
      include: { statements: true }
    });
    const T = new Map(trafficDiagram.statements.map(s => [s.text, s.id]));
    const trafficInf = await prisma.inference.create({
      data: {
        diagramId: trafficDiagram.id,
        kind: 'inductive',
        conclusionId: must(T.get('Bike lanes will worsen traffic congestion'), 'traffic: missing conclusion'),
        schemeKey: 'cause_to_effect',
        cqKeys: [],
      }, select: { id: true }
    });
    await prisma.inferencePremise.createMany({
      data: [
        { inferenceId: trafficInf.id, statementId: must(T.get('Removing one car lane will reduce vehicle capacity'), 'traffic p1') },
        { inferenceId: trafficInf.id, statementId: must(T.get('Maple Ave is already congested during peak hours'), 'traffic p2') },
        { inferenceId: trafficInf.id, statementId: must(T.get('Reduced capacity on congested roads increases delays'), 'traffic warrant') },
      ], skipDuplicates: true
    });

    // 4) Modal-shift (undercuts traffic inference)
    const modalClaim = await prisma.claim.create({
      data: { deliberationId, text: 'The net effect reduces congestion rather than increasing it', createdById: 'system', moid: moid('modal-concl') },
      select: { id: true }
    });
    const modalArg = await prisma.argument.create({
      data: { deliberationId, authorId: 'system', text: 'Modal Shift Response: More biking reduces car traffic',
              claimId: mainClaim.id, conclusionClaimId: modalClaim.id, mediaType: 'text' },
      select: { id: true, text: true }
    });
    const modalDiagram = await prisma.argumentDiagram.create({
      data: {
        title: 'Modal Shift Counterargument',
        createdById: 'system',
        statements: { create: [
          { text: 'Protected lanes increase cycling by 50–75% (Seattle, Portland data)', role: 'premise', tags: ['data'] },
          { text: 'Each new cyclist is one less car on the road', role: 'premise', tags: ['modal-shift'] },
          { text: 'The net effect reduces congestion rather than increasing it', role: 'conclusion', tags: ['rebuttal'] },
        ] }
      },
      include: { statements: true }
    });
    const M = new Map(modalDiagram.statements.map(s => [s.text, s.id]));
    const modalInf = await prisma.inference.create({
      data: {
        diagramId: modalDiagram.id,
        kind: 'inductive',
        conclusionId: must(M.get('The net effect reduces congestion rather than increasing it'), 'modal: missing conclusion'),
        schemeKey: 'cause_to_effect',
        cqKeys: [],
      }, select: { id: true }
    });
    await prisma.inferencePremise.createMany({
      data: [
        { inferenceId: modalInf.id, statementId: must(M.get('Protected lanes increase cycling by 50–75% (Seattle, Portland data)'), 'modal p1') },
        { inferenceId: modalInf.id, statementId: must(M.get('Each new cyclist is one less car on the road'), 'modal p2') },
      ], skipDuplicates: true
    });

    // 5) Expert opinion (supports main)
    const expertArg = await prisma.argument.create({
      data: { deliberationId, authorId: 'system', text: 'Expert Opinion: Transportation planners support the project',
              claimId: mainClaim.id, conclusionClaimId: mainClaim.id, mediaType: 'text' },
      select: { id: true, text: true }
    });
    const expertDiagram = await prisma.argumentDiagram.create({
      data: {
        title: 'Expert Opinion Support',
        createdById: 'system',
        statements: { create: [
          { text: 'City Transportation Department recommends protected lanes for Maple Ave', role: 'premise', tags: ['expert'] },
          { text: 'Transportation planners are experts in urban mobility', role: 'premise', tags: ['credibility'] },
          { text: 'We should follow expert recommendations on technical matters', role: 'warrant', tags: ['epistemic'] },
          { text: 'The city should install protected bike lanes on Maple Avenue', role: 'conclusion', tags: ['recommendation'] },
        ] }
      },
      include: { statements: true }
    });
    const E = new Map(expertDiagram.statements.map(s => [s.text, s.id]));
    const expertInf = await prisma.inference.create({
      data: {
        diagramId: expertDiagram.id,
        kind: 'presumptive',
        conclusionId: must(E.get('The city should install protected bike lanes on Maple Avenue'), 'expert: missing conclusion'),
        schemeKey: 'argument_from_expert_opinion',
        cqKeys: ['CQ1: Is the source a genuine expert?', "CQ2: Is the expert's opinion relevant?"],
      }, select: { id: true }
    });
    await prisma.inferencePremise.createMany({
      data: [
        { inferenceId: expertInf.id, statementId: must(E.get('City Transportation Department recommends protected lanes for Maple Ave'), 'expert p1') },
        { inferenceId: expertInf.id, statementId: must(E.get('Transportation planners are experts in urban mobility'), 'expert p2') },
        { inferenceId: expertInf.id, statementId: must(E.get('We should follow expert recommendations on technical matters'), 'expert warrant') },
      ], skipDuplicates: true
    });

    // 6) Supports & attack edge (modal undercuts traffic)
    await prisma.argumentSupport.createMany({
      data: [
        { deliberationId, claimId: mainClaim.id,    argumentId: safetyArg.id, mode: 'product', strength: 0.72, base: 0.72 },
        { deliberationId, claimId: trafficClaim.id, argumentId: trafficArg.id, mode: 'product', strength: 0.58, base: 0.58 },
        { deliberationId, claimId: modalClaim.id,   argumentId: modalArg.id,   mode: 'product', strength: 0.65, base: 0.65 },
        { deliberationId, claimId: mainClaim.id,    argumentId: expertArg.id,  mode: 'product', strength: 0.68, base: 0.68 },
      ], skipDuplicates: true
    });

    await prisma.argumentEdge.create({
      data: {
        deliberationId,
        fromArgumentId: modalArg.id,
        toArgumentId:   trafficArg.id,
        type: 'undercut' as EdgeType,
        targetScope: 'inference' as TargetScope,
        attackType: 'UNDERCUTS',
        createdById: 'system',
      }
    });

    // 7) Sheet
    const { id: sheetId } = await prisma.debateSheet.create({
      data: {
        title: `Bike Lanes Debate • ${room.slug}`,
        createdById: 'system',
        deliberationId,
        roomId: room.id,
      }, select: { id: true }
    });

    await prisma.debateNode.createMany({
      data: [
        { sheetId, title: mainClaim.text,    claimId: mainClaim.id },
        { sheetId, title: safetyClaim.text,  claimId: safetyClaim.id },
        { sheetId, title: trafficClaim.text, claimId: trafficClaim.id },
        { sheetId, title: costClaim.text,    claimId: costClaim.id },
        { sheetId, title: 'Safety Argument',    argumentId: safetyArg.id, diagramId: safetyDiagram.id },
        { sheetId, title: 'Traffic Argument',   argumentId: trafficArg.id, diagramId: trafficDiagram.id },
        { sheetId, title: 'Modal Shift',        argumentId: modalArg.id,   diagramId: modalDiagram.id },
        { sheetId, title: 'Expert Opinion',     argumentId: expertArg.id,  diagramId: expertDiagram.id },
      ], skipDuplicates: true
    });

    // Response
    return NextResponse.json({
      ok: true,
      room, deliberationId, sheetId,
      urls: {
        room: `/agora/rooms/${room.slug}`,
        deliberation: `/deliberation/${deliberationId}`,
        sheet: `/api/sheets/${sheetId}`,
        sheetAlias: `/api/sheets/delib:${deliberationId}`,
        evidential: `/api/deliberations/${deliberationId}/evidential?mode=product`,
        evidentialMin: `/api/deliberations/${deliberationId}/evidential?mode=min`,
        graph: `/api/deliberations/${deliberationId}/graph?semantics=preferred&confidence=0.6&mode=product`,
      }
    }, NO_STORE);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500, ...NO_STORE });
  }
}
