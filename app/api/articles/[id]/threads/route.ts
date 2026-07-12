export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";


const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  export async function GET(
    _req: Request,
    { params }: { params: { id: string } }
  ) {
    const key = params.id;                         // 👈 comes from folder name [id]
    const where = isUuid(key) ? { id: key } : { slug: key };
  
    const article = await prisma.article.findUnique({ where });
    if (!article) return NextResponse.json({ error: "not found" }, { status: 404 });
  
    if (article.allowAnnotations === false) {
      return NextResponse.json([], { status: 200 }); // or 403 if you prefer
    }
  
    const data = await prisma.commentThread.findMany({
      where: { articleId: article.id },
      include: { comments: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
  
    const payload = data.map((t) => ({
      id: t.id,
      articleId: t.articleId,
      anchor: t.anchor as any,
      resolved: t.resolved,
      createdBy: t.createdBy,
      createdAt: t.createdAt.toISOString(),
      comments: t.comments.map((c) => ({
        id: c.id,
        threadId: c.threadId,
        body: c.body,
        createdBy: c.createdBy,
        createdAt: c.createdAt.toISOString(),
        upvotes: c.upvotes,
        downvotes: c.downvotes,
      })),
    }));
  
    return NextResponse.json(payload);
  }
  
  export async function POST(
    req: Request,
    { params }: { params: { id: string } }
  ) {
    const key = params.id;                         // 👈
    const where = isUuid(key) ? { id: key } : { slug: key };
  
    const article = await prisma.article.findUnique({ where });
    if (!article) return NextResponse.json({ error: "not found" }, { status: 404 });
  
    if (article.allowAnnotations === false) {
      return NextResponse.json({ error: "annotations disabled" }, { status: 403 });
    }
  
    let bodyJson: any = {};
    try { bodyJson = await req.json(); } catch {}
    const { anchor, body } = bodyJson;
  
    if (!anchor || typeof body !== "string" || !body.trim()) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
  
    // TODO: real auth/user
    const userId = "anon";
  
    const thread = await prisma.commentThread.create({
      data: {
        articleId: article.id,
        anchor,
        createdBy: userId,
        comments: { create: { body, createdBy: userId } },
      },
      include: { comments: { orderBy: { createdAt: "asc" } } },
    });
  
    const resp = {
      id: thread.id,
      articleId: thread.articleId,
      anchor: thread.anchor as any,
      resolved: thread.resolved,
      createdBy: thread.createdBy,
      createdAt: thread.createdAt.toISOString(),
      comments: thread.comments.map((c) => ({
        id: c.id,
        threadId: c.threadId,
        body: c.body,
        createdBy: c.createdBy,
        createdAt: c.createdAt.toISOString(),
        upvotes: c.upvotes,
        downvotes: c.downvotes,
      })),
    };
  
    return NextResponse.json(resp, { status: 201 });
  }