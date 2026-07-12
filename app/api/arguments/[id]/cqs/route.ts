export const dynamic = "force-dynamic";

// // app/api/arguments/[id]/cqs/route.ts
// import { NextResponse } from "next/server";
// import { prisma } from "@/lib/prismaclient";

// export async function GET(_req: Request, { params }: { params: { id: string } }) {
//   const arg = await prisma.argument.findUnique({
//     where: { id: params.id },
//     include: { scheme: { include: { cqs: true } } },
//   });
//   if (!arg?.scheme) return NextResponse.json({ ok: true, items: [] });

//   const statuses = await prisma.cQStatus.findMany({ where: { argumentId: arg.id } });
//   const byKey = new Map(statuses.map(s => [s.cqKey, s.status]));

//   const items = arg.scheme.cqs.map(cq => ({
//     cqKey: cq.cqKey!,  // ensure non-null in prisma schema
//     text: cq.text,
//     attackType: cq.attackType,
//     targetScope: cq.targetScope,
//     status: byKey.get(cq.cqKey!) ?? "open",
//   }));
//   return NextResponse.json({ ok: true, items });
// }

// app/api/arguments/[id]/cqs/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(_req: Request, { params }: { params:{ id:string } }) {
  const arg = await prisma.argument.findUnique({
    where: { id: params.id }, include: { scheme:{ include:{ cqs:true } } }
  });
  if (!arg?.scheme) return NextResponse.json({ ok:true, items: [], authorId: arg?.authorId ?? null }, { headers: { 'Cache-Control':'no-store' } });

  const statuses = await prisma.cQStatus.findMany({ where: { argumentId: arg.id } });
  const byKey = new Map(statuses.map(s => [s.cqKey, s.status]));
  const items = arg.scheme.cqs.map(cq => {
    const cqKey = cq.cqKey ?? "";
    return {
      cqKey,
      text: cq.text,
      attackType: cq.attackType,
      targetScope: cq.targetScope,
      premiseType: cq.premiseType,
      status: byKey.get(cqKey) ?? "open"
    };
  });
  // `authorId` is the ARGUMENT's author (Argument.authorId), used by the CQ
  // modal's role detection (is the viewer the author?). Distinct from the acting
  // user that the UI passes for write operations.
  return NextResponse.json({ ok:true, items, authorId: arg.authorId }, { headers: { 'Cache-Control':'no-store' } });
}
