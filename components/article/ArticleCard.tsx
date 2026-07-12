 'use client'
 import Image from 'next/image'
 import Link from 'next/link'
 import { Dialog, DialogTrigger } from '@/components/ui/dialog'
 import ArticlePostModal from '../modals/ArticlePostModal'
 import { useCallback } from 'react'


export type ArticleMeta = {
    articleId?: string | null
    slug: string
    title: string
    heroImageKey?: string | null
    excerpt?: string | null
    readingTime?: number | null
  }

export default function ArticleCard({ meta, postId }: { meta: ArticleMeta; postId: bigint }) {
    const href = `/article/${meta.slug}`
    const onPreview = useCallback(() => {}, [postId])
 
    return (
        <div className='flex flex-1 w-[500px] justify-center items-center  h-[500px] shadow-xl rounded-xl border-[1px] border-amber-400'>
      <div className=" rounded-xl flex-1 border bg-white/70 overflow-y-auto overflow-x-hidden w-full h-full ">
        {meta.heroImageKey && (
          <div className="relative w-full">
            <Image
              src={meta.heroImageKey}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority={false}
            />
          </div>
        )}
        <div className="py-4 px-5">
            <div className="flex">
          <Link href={href} className="block">
            <h3 className="text-[1.32rem] tracking-wider font-semibold leading-snug line-clamp-2" data-ff="founders">
              {meta.title}
            </h3>
          </Link>
          <div className=" flex w-full mb-2 justify-end  items-end gap-2">
           <Dialog>
             <DialogTrigger asChild>
               <button className="flex px-1 py-0 text-slate-600 lockbutton border rounded text-[.7rem] text-center">Preview</button>
             </DialogTrigger>
             <ArticlePostModal slug={meta.slug} />
           </Dialog>
           <Link href={href} className="flex px-1 py-0 lockbutton text-slate-600 border rounded text-[.7rem] text-center">Read</Link>
         </div>
         </div>
          <hr></hr>
          {!!meta.excerpt && (
            <p className="mt-2 text-[.9rem] text-neutral-800 line-clamp-10">{meta.excerpt}</p>
          )}
          {/* <div className="mt-3 p-1 flex items-center gap-2 text-[.7rem] text-neutral-500">
            {meta.readingTime ? <span>{meta.readingTime} min read</span> : null}
          </div>
  */}

         
        </div>
      </div>
      </div>
    )
  }
 