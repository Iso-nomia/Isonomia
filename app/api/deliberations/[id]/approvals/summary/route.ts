export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const deliberationId = params.id;
  const url = new URL(req.url);
  const cohorts = (url.searchParams.get('cohorts') ?? 'all,authors').split(',').map(s=>s.trim());

  const args = await prisma.argument.findMany({
    where: { deliberationId },
    select: { id: true, authorId: true },
  });
  if (!args.length) return NextResponse.json({ totals: {}, byArgument: {} });
  const argIds = args.map(a => a.id);

  // approvals for this deliberation
  const approvals = await prisma.argumentApproval.findMany({
    where: { deliberationId, argumentId: { in: argIds } },
    select: { argumentId: true, userId: true },
  });

  // cohorts: all = all users who approved at least one arg
  const allUsers = new Set(approvals.map(a => a.userId));
  // authors = all users who authored at least one argument
  const authorIds = new Set(args.map(a => a.authorId));

  const totals: Record<string, number> = {};
  if (cohorts.includes('all')) totals['all'] = allUsers.size;
  if (cohorts.includes('authors')) totals['authors'] = authorIds.size;

  // per-argument sets per cohort
  // byArgument[argId] = { all: Set([...]), authors: Set([...]) }
  const byArgument: Record<string, Record<string, string[]>> = {};
  for (const a of approvals) {
    const map: Record<string, Set<string>> = {};
    if (cohorts.includes('all')) (map['all'] ??= new Set()).add(a.userId);
    if (cohorts.includes('authors') && authorIds.has(a.userId)) {
      (map['authors'] ??= new Set()).add(a.userId);
    }
    // merge into result
    byArgument[a.argumentId] ??= {};
    for (const c of Object.keys(map)) {
      const prev = new Set(byArgument[a.argumentId][c] ?? []);
      for (const u of map[c]!) prev.add(u);
      byArgument[a.argumentId][c] = Array.from(prev);
    }
  }

  return NextResponse.json({ totals, byArgument });
}
