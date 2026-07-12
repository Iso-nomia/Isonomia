// components/rhetoric/RhetoricContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type RhetoricMode = 'content' | 'style';
export type ModelLens = 'monological' | 'dialogical' | 'rhetorical';

export type RhetoricCategory =
  | 'hedge' | 'intensifier' | 'absolute'
  | 'analogy' | 'metaphor'
  | 'allcaps' | 'exclaim'
  | 'connectives' | 'evidence'
  | 'ethos' | 'pathos' | 'logos';

export type RhetoricSettings = {
  enableNlp: boolean;
  highlightLexicon: boolean;
  enableMiniMl?: boolean;
};

type EnabledMap = Record<RhetoricCategory, boolean>;

type CtxValue = {
  mode: RhetoricMode;
  setMode: (m: RhetoricMode) => void;

  modelLens: ModelLens;
  setModelLens: (m: ModelLens) => void;

  enabled: EnabledMap;
  toggle: (c: RhetoricCategory) => void;
  setMany: (patch: Partial<EnabledMap>) => void;
  setAll: (on: boolean) => void;
  reset: () => void;

  settings: RhetoricSettings;
  setSettings: (s: RhetoricSettings) => void;
};

const DEFAULT_ENABLED: EnabledMap = {
  hedge: true, intensifier: true, absolute: true,
  analogy: true, metaphor: true, allcaps: true, exclaim: true,
  connectives: true, evidence: true, ethos: true, pathos: true, logos: true,
};

const DEFAULT_SETTINGS: RhetoricSettings = {
  enableNlp: false,
  highlightLexicon: false,
  enableMiniMl: false,
};

// localStorage keys
const K_MODE = 'rhetoric:mode';
const K_LENS = 'rhetoric:modelLens';
const K_ENABLED = 'rhetoric:enabled';
const K_SETTINGS = 'rhetoric:settings';

const Ctx = createContext<CtxValue | null>(null);

function readLS<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
function writeLS<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function RhetoricProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<RhetoricMode>('content');
  const [modelLens, setModelLens] = useState<ModelLens>('rhetorical');
  const [enabled, setEnabled] = useState<EnabledMap>(DEFAULT_ENABLED);
  const [settings, setSettings] = useState<RhetoricSettings>(DEFAULT_SETTINGS);

  // hydrate
  useEffect(() => {
    setMode(readLS<RhetoricMode>(K_MODE, 'content'));
    setModelLens(readLS<ModelLens>(K_LENS, 'rhetorical'));
    setEnabled(readLS<EnabledMap>(K_ENABLED, DEFAULT_ENABLED));
    setSettings(readLS<RhetoricSettings>(K_SETTINGS, DEFAULT_SETTINGS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist
  useEffect(() => { writeLS(K_MODE, mode); }, [mode]);
  useEffect(() => { writeLS(K_LENS, modelLens); }, [modelLens]);
  useEffect(() => { writeLS(K_ENABLED, enabled); }, [enabled]);
  useEffect(() => { writeLS(K_SETTINGS, settings); }, [settings]);

  const value = useMemo<CtxValue>(() => ({
    mode, setMode,
    modelLens, setModelLens,

    enabled,
    toggle: (k: RhetoricCategory) => setEnabled(prev => ({ ...prev, [k]: !prev[k] })),
    setMany: (patch: Partial<EnabledMap>) => setEnabled(prev => ({ ...prev, ...patch })),
    setAll: (on: boolean) => {
      const all: EnabledMap = {
        hedge: on, intensifier: on, absolute: on,
        analogy: on, metaphor: on, allcaps: on, exclaim: on,
        connectives: on, evidence: on, ethos: on, pathos: on, logos: on,
      };
      setEnabled(all);
    },
    reset: () => {
      setMode('content');
      setModelLens('rhetorical');
      setEnabled(DEFAULT_ENABLED);
      setSettings(DEFAULT_SETTINGS);
    },

    settings,
    setSettings,
  }), [mode, modelLens, enabled, settings]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRhetoric() {
  const c = useContext(Ctx);
  if (!c) throw new Error('RhetoricProvider missing');
  return c;
}

export function useRhetoricOptional() {
  return useContext(Ctx);
}
