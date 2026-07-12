"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MessageSquare, Aperture, LoaderPinwheel } from "lucide-react";

export function DeliberationLoadingScreen({ hostName }: { hostName?: string | null }) {
  const [visibleLines, setVisibleLines] = useState(1);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const id = setInterval(
      () => setVisibleLines((n) => (n >= LOGS.length ? 1 : n + 1)),
      1100
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-screen overflow-hidden ">
     
      <div className="relative z-10 mx-auto max-w-2xl px-4">
        {/* Title section - mimics the main page header */}
        <div className="text-center mb-8">
        <h2 className="text-4xl font-[Kolonia] uppercase tracking-wide text-center text-slate-800 mb-4">
            {hostName ? `Deliberation for "${hostName}"` : "Deliberation"}
          </h2>
          <div className="mx-auto w-[100%] border-b border-slate-400/40" />
        </div>

        <div className="mb-6 cardv2 bg-white/50 inline-flex select-none items-center gap-2 rounded-full px-5 py-2.5 text-xs text-slate-600 backdrop-blur-lg">
          <LoaderPinwheel className="h-3.5 w-3.5 text-indigo-500" />
          <span>Loading Deliberation Space</span>
        </div>

        <ConsoleCard visibleLines={visibleLines} prefersReduced={!!prefersReduced} />
      </div>
    </div>
  );
}

function ConsoleCard({
  visibleLines,
  prefersReduced,
}: {
  visibleLines: number;
  prefersReduced: boolean;
}) {
  return (
    <div className="overflow-hidden max-h-screen rounded-2xl cardv2 p-0  shadow-[0_10px_40px_-10px_rgba(2,6,23,0.12)] backdrop-blur-lg">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-slate-200/90 bg-white px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-300"></span>
          <span className="h-3 w-3 rounded-full bg-amber-300"></span>
          <span className="h-3 w-3 rounded-full bg-emerald-300"></span>
        </div>
        <div className="ml-3 text-xs text-slate-500">
          mesh / deliberation-init
        </div>
      </div>

      {/* Body */}
      <div className="relative p-6 font-mono text-[13px] leading-relaxed">
        <div className="mb-6 flex items-center gap-4">
          <Spinner prefersReduced={prefersReduced} />
          <div className="text-sm">
            <span className="text-slate-600">Initializing deliberation framework…</span>
          </div>
        </div>

        {/* Logs */}
        <div className="space-y-2.5 text-slate-700">
          {LOGS.slice(0, visibleLines).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="flex items-center gap-2"
            >
              <span className="text-slate-400">
                [{String(i + 1).padStart(2, "0")}]
              </span>
              <span className="text-indigo-600">$</span>
              <span className="text-slate-700">{line}</span>
              {i === visibleLines - 1 && <Caret />}
            </motion.div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="mt-6 text-xs text-slate-500">
          Loading arguments, claims, and dialogue structure...
        </div>
      </div>
    </div>
  );
}

const LOGS = [
  "Fetching deliberation metadata…",
  "Loading argument graph structure…",
  "Retrieving claims and propositions…",
  "Initializing dialogue framework…",
  "Building visualization layers…",
  "Preparing authoring tools…",
];

function Caret() {
  return (
    <motion.span
      className="ml-1 inline-block h-4 w-2 translate-y-[2px] bg-slate-500"
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 1.1, repeat: Infinity }}
    />
  );
}

// Fancy rotating spinner with bouncy momentum
function Spinner({ prefersReduced }: { prefersReduced: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 50 50"
      className="h-10 w-10 text-indigo-400"
      aria-hidden
      animate={{ rotate: 360 }}
      transition={{
        duration: prefersReduced ? 0 : 1,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      <circle
        cx="25"
        cy="25"
        r="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="60 180"
      />
    </motion.svg>
  );
}

/* ----------------------------- Background FX ----------------------------- */
function GridBG() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* soft grid over a pastel wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-100/60 via-purple-100/60 to-slate-100/60" />
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.08,
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.2) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* gentle moving glows in site palette */}
      <motion.div
        className="absolute -top-24 left-1/3 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 50%, rgba(99,102,241,0.45) 0%, transparent 60%)",
        }}
        animate={{ x: [0, 20, 0], y: [0, 12, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 h-[26rem] w-[26rem] translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 50%, rgba(168,85,247,0.45) 0%, transparent 60%)",
        }}
        animate={{ x: [0, -16, 0], y: [0, -10, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
