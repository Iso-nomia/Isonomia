// app/%28editor%29/article/new/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { Terminal } from 'lucide-react'

export default function NewArticlePage() {
  const router = useRouter()
  const ran = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    ;(async () => {
      const KEY = 'draftArticleId'
      try {
        const existing = localStorage.getItem(KEY)
        if (existing) {
          const check = await fetch(`/api/articles/${existing}`, { cache: 'no-store' })
          if (check.ok) {
            router.replace(`/article/by-id/${existing}/edit`)
            return
          }
          localStorage.removeItem(KEY)
        }

        const res = await fetch('/api/articles', { method: 'POST' })
        if (res.status === 401) {
          router.replace('/login')
          return
        }
        if (!res.ok) throw new Error(await res.text())
        const { id } = (await res.json()) as { id: string }

        localStorage.setItem(KEY, id)
        router.replace(`/article/by-id/${id}/edit`)
      } catch (err: any) {
        console.error('Failed to create draft:', err)
        setError(err?.message || 'Something went wrong creating your draft.')
      }
    })()
  }, [router])

  return (
    // <div className="relative min-h-[80vh] overflow-hidden bg-gradient-to-b from-indigo-50 via-rose-50 to-slate-50 text-slate-900">
    <div className="fixed inset-0 z-50 isolate overflow-auto w-full h-full bg-gradient-to-b from-indigo-50 via-rose-50 to-slate-50 text-slate-900">

      <GridBG />
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-16">
        <div className="mb-6 inline-flex select-none items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600 backdrop-blur">
          <Terminal className="h-3.5 w-3.5 text-indigo-500" />
          <span>Launching Article Editor</span>
        </div>

        <ConsoleCard error={!!error} message={error ?? undefined} />
      </div>
    </div>
  )
}

/* ----------------------- Console‑style Loader (pastel) --------------------- */
function ConsoleCard({ error, message }: { error?: boolean; message?: string }) {
  const [visibleLines, setVisibleLines] = useState(1)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    if (error) return
    const id = setInterval(() => setVisibleLines((n) => (n >= LOGS.length ? 1 : n + 1)), 1100)
    return () => clearInterval(id)
  }, [error])

  return (
    <div className="overflow-hidden max-h-screen
     rounded-2xl border border-slate-200 bg-white/85 shadow-[0_10px_40px_-10px_rgba(2,6,23,0.12)] backdrop-blur">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-slate-200/90 bg-slate-50/60 px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-300"></span>
          <span className="h-3 w-3 rounded-full bg-amber-300"></span>
          <span className="h-3 w-3 rounded-full bg-emerald-300"></span>
        </div>
        <div className="ml-3 text-xs text-slate-500">mesh / editor‑boot</div>
      </div>

      {/* Body */}
      <div className="relative p-6 font-mono text-[13px] leading-relaxed">
        <div className="mb-6 flex items-center gap-4">
          <Spinner prefersReduced={prefersReduced ?? false} />
          <div className="text-sm">
            {error ? (
              <span className="font-medium text-rose-600">{message}</span>
            ) : (
              <span className="text-slate-600">Preparing environment…</span>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className="space-y-2.5 text-slate-700">
          {error ? (
            <div className="text-rose-600">✖ {message}</div>
          ) : (
            LOGS.slice(0, visibleLines).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="flex items-center gap-2"
              >
                <span className="text-slate-400">[{String(i + 1).padStart(2, '0')}]</span>
                <span className="text-indigo-600">$</span>
                <span className="text-slate-700">{line}</span>
                {i === visibleLines - 1 && <Caret />}
              </motion.div>
            ))
          )}
        </div>

        {/* Footer hint */}
        {!error && (
          <div className="mt-6 text-xs text-slate-500">You can start writing immediately once the editor appears.</div>
        )}

        {/* Actions on error */}
        {error && (
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => location.reload()}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 active:translate-y-px"
            >
              Retry
            </button>
            <a
              href="/"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Home
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

const LOGS = [
  'Allocating editor buffers…',
  'Fetching user preferences…',
  'Linking extensions & shortcuts…',
  'Starting collaboration layer…',
  'Creating a fresh draft…'
]

function Caret() {
  return (
    <motion.span
      className="ml-1 inline-block h-4 w-2 translate-y-[2px] bg-slate-500"
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 1.1, repeat: Infinity }}
    />
  )
}


// Fancy stroke-dashoffset pulse spinner
function Spinner({ prefersReduced }: { prefersReduced: boolean }) {
  return (
  <motion.svg
  viewBox="0 0 50 50"
  className="h-10 w-10 text-indigo-400"
  aria-hidden
  >
  <motion.circle
  cx="25"
  cy="25"
  r="20"
  fill="none"
  stroke="currentColor"
  strokeWidth="4"
  strokeLinecap="round"
  strokeDasharray="60 120"
  animate={{ strokeDashoffset: [60, 180, 60] }}
  transition={{ duration: prefersReduced ? 0 : 1.5, repeat: Infinity, ease: 'easeInOut' }}
  />
  </motion.svg>
  )
  }
/* ----------------------------- Background FX ----------------------------- */
function GridBG() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* soft grid over a pastel wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-100/60 via-rose-100/60 to-slate-100/60" />
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.08,
          backgroundImage:
            'linear-gradient(to right, rgba(15,23,42,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.2) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* gentle moving glows in site palette */}
      <motion.div
        className="absolute -top-24 left-1/3 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(60% 60% at 50% 50%, rgba(99,102,241,0.45) 0%, transparent 60%)' }}
        animate={{ x: [0, 20, 0], y: [0, 12, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 h-[26rem] w-[26rem] translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(60% 60% at 50% 50%, rgba(244,114,182,0.45) 0%, transparent 60%)' }}
        animate={{ x: [0, -16, 0], y: [0, -10, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
