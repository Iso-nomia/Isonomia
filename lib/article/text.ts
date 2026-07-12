// lib/article/text.ts
export function plainTextFromAst(ast: any): string {
    // super-light extractor; fine for publish step
    const walk = (n: any): string => {
      if (!n) return ''
      if (n.text) return n.text
      if (Array.isArray(n.content)) return n.content.map(walk).join(' ')
      return ''
    }
    return walk(ast).replace(/\s+/g, ' ').trim()
  }
  export function computeExcerpt(text: string, max = 1200): string {
    if (!text) return ''
    if (text.length <= max) return text
    const cut = text.slice(0, max)
    return cut.slice(0, cut.lastIndexOf(' ')).trim() + '…'
  }
  export function readingTime(text: string, wpm = 225): number {
    const words = (text.match(/\S+/g) || []).length
    return Math.max(1, Math.ceil(words / wpm))
  }
  