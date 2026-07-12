export const dynamic = "force-dynamic";

import { prisma } from '@/lib/prismaclient';
import { NextResponse } from 'next/server';
import { getUserFromCookies } from '@/lib/serverutils';
import { z } from 'zod';

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  is_public: z.boolean().optional(),
  visibility: z.enum(["public_open", "public_closed", "private", "unlisted"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromCookies();
  if (!user || user.userId == null) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  
  const { name, description, is_public, visibility } = parsed.data;
  
  // Build update data only with provided fields
  const updateData: any = {};
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description;
  if (is_public !== undefined) updateData.is_public = is_public;
  if (visibility !== undefined) {
    updateData.visibility = visibility;
    // Sync is_public for backward compatibility
    updateData.is_public = visibility === "public_open" || visibility === "public_closed" || visibility === "unlisted";
  }
  
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await prisma.stack.update({
    where: { id: params.id, owner_id: BigInt(user.userId) } as any,
    data: updateData,
  });

  return NextResponse.json({ ok: true });
}


export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const st = await prisma.stack.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      slug: true,
      is_public: true,
      subscribers: { select: { user_id: true } },
    },
  });
  if (!st) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    id: st.id,
    name: st.name,
    slug: st.slug ?? null,
    is_public: st.is_public,
    subscriberCount: st.subscribers.length,
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromCookies();
  if (!user || user.userId == null) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  await prisma.stack.delete({ where: { id: params.id, owner_id: BigInt(user.userId) } as any });
  return NextResponse.json({ ok: true });
}
