'use client'

import { useEffect, useState } from 'react'
import { DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import Image from 'next/image'
import Link from 'next/link'

type Props = {
  slug?: string
  articleId?: string
}

type Preview = {
  title: string
  slug: string
  heroImageKey: string | null
  html: string
  publishedAt: string | null
  readingTime: number | null
  excerpt: string | null
}

export default function ArticlePostModal({ slug, articleId }: Props) {
  const [data, setData] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const qs = slug ? `slug=${encodeURIComponent(slug)}` : `id=${encodeURIComponent(articleId!)}`
      const res = await fetch(`/api/articles/preview?${qs}`, { cache: 'no-store' })
      if (!res.ok) { setLoading(false); return }
      const json = await res.json()
      if (!cancelled) { setData(json); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [slug, articleId])

  return (
    <DialogContent className="max-w-[920px] bg-white max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{data?.title ?? 'Article'}</DialogTitle>
      </DialogHeader>

      {loading ? (
        <div className="p-6 text-sm text-neutral-600">Loading…</div>
      ) : data ? (
        <div className="space-y-4">
          {data.heroImageKey && (
            <div className="relative aspect-[16/9]">
              <Image src={data.heroImageKey} alt="" fill className="object-cover rounded-lg" />
            </div>
          )}

          <div className="prose max-w-none">
            <div dangerouslySetInnerHTML={{ __html: data.html }} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <DialogClose asChild>
              <button className="px-3 py-2 rounded border">Close</button>
            </DialogClose>
            <Link
              href={`/article/${data.slug}`}
              className="px-3 py-2 rounded bg-black text-white"
        
            >
              Read full article
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-6 text-sm text-red-600">Could not load article.</div>
      )}
    </DialogContent>
  )
}
