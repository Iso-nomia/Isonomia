// components/article/ArticleReader.tsx
'use client'

import clsx from 'clsx'


interface ArticleReaderProps {
  template: string
  heroSrc?: string | null
  children: React.ReactNode
    title?: string                 // ⬅️ new
}



export default function ArticleReader({
  template,
  heroSrc,
  children,
  title,
}: ArticleReaderProps) {
  return (
    <article className={clsx(template, 'w-full mx-auto')}>
        {title && (
        <header className="mb-4">
          <h1 className="relative text-4xl font-semibold text-center items-center justify-center tracking-wide mx-auto">{title}</h1>
        </header>
      )}
      <hr className="w-[100%] border-[.5px] border-slate-700/70 justify-center items-center mx-auto mt-4 mb-2"></hr>
      {heroSrc && (
        <img
          src={heroSrc}
          alt=""
          className="mb-8 w-full rounded-lg object-cover  "
        />
      )}
      {children}
    </article>
  )
}