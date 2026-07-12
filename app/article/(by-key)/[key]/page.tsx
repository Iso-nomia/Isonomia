// app/article/(by-key)/[key]/page.tsx
import { prisma } from "@/lib/prismaclient";
import { notFound } from "next/navigation";
import { generateHTML } from "@tiptap/html";            // ✅ named import only
import DeepDivePanel from '@/components/deepdive/DeepDivePanel';
import { getOrCreateDeliberationId } from '@/lib/deepdive/upsert';
import { getCurrentUserId } from "@/lib/serverutils";
import { tiptapSharedExtensions } from '@/lib/tiptap/extensions/shared';
import { createLowlight } from "lowlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import { wrapSections } from '@/lib/article/wrapSections';
import { SectionBreak } from "@/lib/tiptap/extensions/sectionBreak";
import { ParagraphKeepEmptySSR } from '@/lib/tiptap/extensions/ParagraphKeepEmptySSR';

import NextLink from "next/link";                     // ✅ NEXT link (aliased)

import Link from "@tiptap/extension-link";
import ArticleReaderWithPins from "@/components/article/ArticleReaderWithPins";

// your custom nodes/extensions
import {
  PullQuote,
  Callout,
  MathBlock,
  MathInline,
  CustomImage,
} from "@/lib/tiptap/extensions";

// if you still rely on these SSR tokenizers, keep them (they’re no-ops if unused)
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { SSRTextAlign } from "@/lib/tiptap/extensions/ssr-text-align";
import { TextStyleTokens } from "@/lib/tiptap/extensions/text-style-ssr";
import { BlockStyleTokens } from "@/lib/tiptap/extensions/block-style-ssr";

export default async function ArticlePage({ params }: { params: { key: string } }) {
  const where = /^[0-9a-f-]{36}$/i.test(params.key) ? { id: params.key } : { slug: params.key };
  const article = await prisma.article.findUnique({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      authorId: true,
      publishedAt: true,
      template: true,
      astJson: true,
      heroImageKey: true,
      deletedAt: true,
    },
  });
  if (!article) notFound();

  const userId = await getCurrentUserId().catch(() => null);
  const deliberationId = await getOrCreateDeliberationId(
    'article',
    article.id,
    null, // roomId no longer on Article model
    userId != null ? String(userId) : 'system'
  );

  const threadsDb = await prisma.commentThread.findMany({
    where: { articleId: article.id },
    include: { comments: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const lowlight = createLowlight();
  lowlight.register("js", javascript);
  lowlight.register("ts", typescript);
  lowlight.register("py", python);
  lowlight.register("sh", bash);

  const threads = threadsDb.map(t => ({
    id: t.id,
    articleId: t.articleId,
    anchor: t.anchor as any,
    resolved: t.resolved,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
    comments: t.comments.map(c => ({
      id: c.id,
      threadId: c.threadId,
      body: c.body,
      createdBy: c.createdBy,
      createdAt: c.createdAt.toISOString(),
      upvotes: c.upvotes,
      downvotes: c.downvotes,
    })),
  }));

  // ✅ Use the SAME base extensions as the editor, then append your custom nodes
  const base = tiptapSharedExtensions(); // includes TextStyle + Color + SSRTextAlign + StarterKit (per your shared.ts)
  let html = '';
  try {
    html = generateHTML(article.astJson as any, [
    ...base,
    CodeBlockLowlight.configure({ lowlight }),
    TaskList,
    TaskItem,
    CustomImage,
    PullQuote,
    Callout,
    MathBlock,
    MathInline,

    Link.configure({ openOnClick: true, autolink: true }),
    ParagraphKeepEmptySSR,      // <-- last, to override paragraph renderHTML in SSR

    // keep your SSR tokenizers if they add data-* attrs you rely on:
    TextStyleTokens,
    BlockStyleTokens,
    // Note: SSRTextAlign is already in base; if not, you can keep it here too:
    // SSRTextAlign.configure({ types: ['heading','paragraph'] }),
  ]) }
  catch (e) {
    console.error('TipTap SSR failed', e);
    html = '<p>Sorry — this article could not be rendered.</p>';
  }
  // html = wrapSections(html, { collapsed: false, articleId: article.id });

  return (
         <>
       <div className="    absolute flex right-6 top-6 tracking-wide z-[9000] justify-end  mx-auto  ">
         <NextLink
           href={`/deliberation/${deliberationId}`}
            className="lockbutton py-2 px-2 bg-white/20 rounded-xl"

           prefetch
         >
          Discussion Page ↗
         </NextLink>
       </div>
    <ArticleReaderWithPins
      template={article.template}
      heroSrc={article.heroImageKey}
      html={html}

      threads={threads}
      articleSlug={params.key}
      title={article.title}
      deliberationId={deliberationId}
    />
   </>
  );

}