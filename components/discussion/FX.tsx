// components/discussion/FX.tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";

export function GridBG({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none max-w-screen rounded-xl p-1 w-full absolute inset-0 ${className}`}>
      <div className="absolute rounded-xl w-full p-2 inset-0 bg-gradient-to-b from-indigo-100/60 via-rose-100/60 to-slate-100/60" />
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.08,
          backgroundImage:
            'linear-gradient(to right, rgba(15,23,42,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.2) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
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
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.svg viewBox="0 0 50 50" className={`h-5 w-5 text-indigo-400 ${className}`} aria-hidden>
      <motion.circle
        cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="60 120"
        animate={{ strokeDashoffset: [60, 180, 60] }}
        transition={{ duration: reduced ? 0 : 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.svg>
  );
}
