export const dynamic = "force-dynamic";

// app/api/articles/[id]/draft/route.ts
import { prisma } from '@/lib/prismaclient'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserFromCookies } from '@/lib/serverutils'
// app/api/articles/[id]/draft/route.ts
const schema = z.object({
    astJson: z.any().optional(),
    template: z.string().optional(),
    heroImageKey: z.string().nullable().optional(),
    title: z.string().min(1).max(200).optional(),
  })     

  export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
  ) {
    const user = await getUserFromCookies()
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })



  const safe = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(safe)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
 // check ownership first
 const a = await prisma.article.findUnique({ where: { id: params.id } })
 if (!a || a.authorId !== user.userId.toString()) {
   return NextResponse.json({ error: 'Not found' }, { status: 404 })
 }
   const { title, ...rest } = parsed.data
   const data: any = { ...rest }
   // Only update title when it's present and non-empty (and not your sentinel)
   if (typeof title === 'string' && title.trim() && title.trim() !== 'Untitled') {
     data.title = title.trim()
   }
 
   await prisma.article.update({ where: { id: params.id }, data })
 return NextResponse.json({ ok: true })
}
