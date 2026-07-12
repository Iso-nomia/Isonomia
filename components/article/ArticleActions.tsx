'use client'
import { useState } from 'react'

export default function ArticleActions(
  { articleId, initialLikes, slug }: { articleId: string; initialLikes: number; slug: string }
) {
  const [likes, setLikes] = useState(initialLikes)

  async function onLike() {
    setLikes(x => x + 1)               // optimistic
    await fetch(`/api/articles/${articleId}/like`, { method: 'POST' }).catch(() => {
      setLikes(x => Math.max(0, x - 1)) // rollback on error
    })
  }
  async function onSave() {
    await fetch(`/api/articles/${articleId}/save`, { method: 'POST' })
  }
  function onShare() {
    const url = `${window.location.origin}/article/${slug}`
    navigator.clipboard.writeText(url)
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <button className="px-2 py-1 border rounded" onClick={onLike}>👍 {likes}</button>
      <button className="px-2 py-1 border rounded" onClick={onSave}>Save</button>
      <button className="px-2 py-1 border rounded" onClick={onShare}>Share</button>
    </div>
  )
}
