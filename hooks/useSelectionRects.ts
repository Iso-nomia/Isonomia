// useSelectionRects.ts
import { useCallback, useEffect, useState } from 'react'

type R = { left: number; top: number; width: number; height: number }
export function useSelectionRects(root: React.RefObject<HTMLElement>) {
  const [rects, setRects] = useState<R[]>([])

  const recompute = useCallback(() => {
    const el = root.current
    if (!el) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) { setRects([]); return }

    const range = sel.getRangeAt(0)
    const boxes = Array.from(range.getClientRects())
    const cr = el.getBoundingClientRect()
    const dx = -cr.left + el.scrollLeft
    const dy = -cr.top  + el.scrollTop

    setRects(boxes.map(b => ({
      left: b.left + dx,
      top : b.top  + dy,
      width: b.width,
      height: b.height,
    })))
  }, [root])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const onScroll = () => recompute()
    document.addEventListener('selectionchange', recompute)
    window.addEventListener('resize', recompute)
    el.addEventListener('scroll', onScroll, { passive: true })
    // recompute when images finish loading (layout shift)
    const imgs = el.querySelectorAll('img')
    imgs.forEach(img => img.addEventListener('load', recompute, { once: true }))
    return () => {
      document.removeEventListener('selectionchange', recompute)
      window.removeEventListener('resize', recompute)
      el.removeEventListener('scroll', onScroll)
    }
  }, [root, recompute])

  return rects
}