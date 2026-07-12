import ArticleModal from '@/components/modals/ArticlePostModal'
import { prisma } from '@/lib/prismaclient'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import Link from 'next/link'
import { TextStyleTokens } from '@/lib/tiptap/extensions/text-style-ssr'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Callout, CustomImage, MathBlock, MathInline, PullQuote } from '@/lib/tiptap/extensions'

export default async function ArticlePreviewModal({ params }: { params: { slug: string } }) {
  const a = await prisma.article.findUnique({ where: { slug: params.slug } })
  if (!a || a.status !== 'PUBLISHED') return null

  // **Preview**: only first 2–3 paragraphs
  function clipAst(ast: any, maxParas = 3) {
    const doc = JSON.parse(JSON.stringify(ast))
    const paras = (doc.content || []).filter((n: any) => n.type === 'paragraph')
    const keep = paras.slice(0, maxParas)
    return { type: 'doc', content: keep }
  }
  const previewAst = clipAst(a.astJson)
  const html = generateHTML(previewAst as any, [
    StarterKit, Highlight, Underline, TaskList, TaskItem,
    CustomImage, PullQuote, Callout, MathBlock, MathInline,
    TextAlign.configure({ types: ['heading','paragraph','blockquote','listItem'] }),
    TextStyleTokens,
  ])

  return <ArticleModal slug={params.slug} />
}
