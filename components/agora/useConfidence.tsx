// "use client";
// import React from "react";

// type Mode = "min" | "product" | "ds";
// type Ctx = {
//   mode: Mode;
//   setMode: (m: Mode) => void;
//   tau: number | null;
//   setTau: (t: number | null) => void;
// };

// const ConfidenceContext = React.createContext<Ctx | null>(null);

// export function ConfidenceProvider({ children }: { children: React.ReactNode }) {
//   const [mode, setMode] = React.useState<Mode>("product");
//   const [tau, setTau] = React.useState<number | null>(null);
//   return (
//     <ConfidenceContext.Provider value={{ mode, setMode, tau, setTau }}>
//       {children}
//     </ConfidenceContext.Provider>
//   );
// }

// export function useConfidence() {
//   const ctx = React.useContext(ConfidenceContext);
//   if (!ctx) throw new Error("useConfidence must be used within <ConfidenceProvider>");
//   return ctx;
// }
// components/agora/useConfidence.ts
"use client";
import React from 'react';

export type Mode = 'min'|'product'|'logodds';
type Ctx = {
  mode: Mode; setMode: (m:Mode)=>void;
  tau: number|null; setTau: (t:number|null)=>void;
};

const ConfidenceContext = React.createContext<Ctx | null>(null);

export function ConfidenceProvider({ children }: { children: React.ReactNode }) {
  // Phase 5b step 1: log-odds is the default confidence algebra (was 'product').
  const [mode, setMode] = React.useState<Mode>('logodds');
  const [tau, setTau]   = React.useState<number|null>(null);

  // Persist globally (so graph + sheet stay in sync between page loads)
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('agora:confidence');
      if (raw) {
        const j = JSON.parse(raw);
        // Phase 4: DS mode retired — migrate any persisted 'ds' to 'product'.
        if (j.mode) setMode(j.mode === 'ds' ? 'product' : j.mode);
        if ('tau' in j) setTau(j.tau);
      }
    } catch {}
  }, []);
  React.useEffect(() => {
    try { localStorage.setItem('agora:confidence', JSON.stringify({ mode, tau })); } catch {}
  }, [mode, tau]);

  return (
    <ConfidenceContext.Provider value={{ mode, setMode, tau, setTau }}>
      {children}
    </ConfidenceContext.Provider>
  );
}

export function useConfidence() {
  const ctx = React.useContext(ConfidenceContext);
  if (!ctx) throw new Error('useConfidence must be used within <ConfidenceProvider>');
  return ctx;
}

/**
 * Non-throwing variant of {@link useConfidence}. Returns `null` when no
 * `<ConfidenceProvider>` is in scope, so components that may render outside a
 * provider (e.g. demo/test surfaces) can fall back to a default mode.
 */
export function useConfidenceOptional() {
  return React.useContext(ConfidenceContext);
}
