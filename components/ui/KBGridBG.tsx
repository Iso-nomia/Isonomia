// components/ui/GridBG.tsx

'use client';
import { motion } from 'framer-motion'

export function KBGridBG() {
  return (
    // 3. Change h-[3000px] to h-full and set z-index to 0.
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 h-full ">
      {/* soft grid over a pastel wash */}
      <div className="absolute flex-1 h-full inset-0 bg-gradient-to-br from-slate-100 via-indigo-50 to-rose-100" />
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.08,
          backgroundImage:
            'linear-gradient(to right, rgba(15,23,42,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.2) 1px, transparent 1px)',
          backgroundSize: '12px 12px',
        }}
      />
      {/* gentle moving glows in site palette
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
      /> */}
    </div>
  )
}