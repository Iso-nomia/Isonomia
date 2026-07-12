export const dynamic = "force-dynamic";

import { NextRequest } from 'next/server';
import { prisma } from '../_prisma';
import { ok, badRequest } from '../_util';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get('ownerId');
  if (!ownerId) return badRequest('Missing ownerId');
  const rows = await prisma.sheafAudienceList.findMany({
    where: { ownerId: BigInt(ownerId) },
    select: { id: true, name: true }
  });
  return ok({ lists: rows });
}
