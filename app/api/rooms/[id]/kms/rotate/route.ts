// app/api/rooms/[id]/kms/rotate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { rotateKey } from '@/server/provisioner/kms';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = new PrismaClient();
  const room = await prisma.room.findUnique({ where: { id: params.id } });
  if (!room?.kmsKeyArn) return NextResponse.json({ error: 'Room/KMS not found' }, { status: 404 });
  const aliasName = `alias/mesh/room/${room.id}`;
  const newArn = await rotateKey(process.env.AWS_REGION!, aliasName);
  await prisma.room.update({ where: { id: params.id }, data: { kmsKeyArn: newArn } });
  return NextResponse.json({ ok: true, kmsKeyArn: newArn });
}
