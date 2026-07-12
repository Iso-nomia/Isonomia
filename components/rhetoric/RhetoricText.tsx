// components/rhetoric/RhetoricText.tsx
'use client';

import * as React from 'react';
import { useRhetoric, RhetoricCategory } from './RhetoricContext';
import { analyzeText, Hit, Category } from './detectors';
import { analyzeNlp } from './nlpLite';
import { scanLexiconHits } from './lexiconAnalyzers';

// Priority order (remove duplicate 'allcaps')
const ORDER: Category[] = [
  'analogy','metaphor',
  'booster','absolute','hedge',
   // Prefer Logos over bare evidence numbers
  'logos',
  'connective-support','connective-result','connective-contrast','connective-concession','connective-condition',
  'ethos','weasel','evidence','rhet-question',

  'inference-deductive','inference-inductive','inference-abductive',

  // Prefer Frames over Affect/Pathos to keep multi-word policy frames
  'frame-economic','frame-morality','frame-security','frame-fairness','frame-capacity',
  'affect-positive','affect-negative',
  'pathos',
  'allcaps',
  // Layer B
  'imperative','passive','nominalization','parallelism',
  'modal-certainty','modal-uncertainty','negation','pronoun-you','pronoun-we',
];

type Props = { text: string; onHits?: (hits: Hit[]) => void };

const TOGGLE_MAP = {
  hedge: 'hedge',
  booster: 'intensifier',
  absolute: 'absolute',
  analogy: 'analogy',
  metaphor: 'metaphor',
  allcaps: 'allcaps',
  exclaim: 'exclaim',
  'connective-support': 'connectives',
  'connective-result': 'connectives',
  'connective-contrast': 'connectives',
  'connective-concession': 'connectives',
  'connective-condition': 'connectives',
  evidence: 'evidence',
  ethos: 'ethos',
  pathos: 'pathos',
  logos: 'logos',
} as const;


export default function RhetoricText({ text, onHits }: Props) {
  const { mode, settings, enabled } = useRhetoric();

  

  // Layer A
  const heur = React.useMemo(() => analyzeText(text || ''), [text]);

  // Layer B (optional)
  const [nlpHits, setNlpHits] = React.useState<Hit[]>([]);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (mode !== 'style' || !settings.enableNlp || !text) {
        if (alive) setNlpHits([]);
        return;
      }
      try {
        const extra = await analyzeNlp(text, {
          imperatives: true,
          passives: true,
          nominalizations: true,
          parallelism: true,
          modals: true,
          negation: true,
          pronouns: true,
        });
// Normalize: only keep well-formed hits
        const normalized = Array.isArray(extra)
          ? extra.filter((h: any) =>
              h &&
              typeof h.start === 'number' &&
              typeof h.end === 'number' &&
              typeof h.match === 'string' &&
              typeof h.cat === 'string'
            )
          : [];
        if (alive) setNlpHits(normalized as Hit[]);      } catch {
        if (alive) setNlpHits([]);
      }
    })();
    return () => { alive = false; };
  }, [text, mode, settings.enableNlp]);

  // Layer C (optional)
  const lexHits = React.useMemo<Hit[]>(() => {
    if (mode !== 'style' || !settings.highlightLexicon || !text) return [];
    return scanLexiconHits(text);
  }, [mode, settings.highlightLexicon, text]);

  // Filter by toggles
  const filteredHeur = React.useMemo(
    () => filterByToggles(heur.hits, enabled),
    [heur.hits, enabled]
  );
  const filteredNlp = React.useMemo(
    () => filterByToggles(nlpHits, enabled),
    [nlpHits, enabled]
  );

  const exclaimHits = React.useMemo(() => {
    if (!enabled.exclaim || !text) return [];
    const out: Hit[] = [];
    const re = /!+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      out.push({ cat: 'exclaim', start: m.index, end: m.index + m[0].length, match: m[0] });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out;
  }, [enabled.exclaim, text]);

  // ✅ Always compute merged (empty in content mode) to keep hook order stable
  const merged = React.useMemo(() => {
    if (mode === 'content') return [] as Hit[];
    return mergeByPriority([...filteredHeur, ...filteredNlp, ...lexHits, ...exclaimHits]);
  }, [mode, filteredHeur, filteredNlp, lexHits, exclaimHits]);

  // ✅ Always run this effect (no-op if onHits is undefined or merged is empty)
  React.useEffect(() => {
    if (onHits) onHits(merged);
  }, [onHits, merged]);

  // Render branch
  if (mode === 'content') return <>{text}</>;
  return <span>{renderWithHighlights(text, merged)}</span>;
}

/* ----------------- helpers ----------------- */

function filterByToggles(hits: Hit[], enabled: Record<RhetoricCategory, boolean>): Hit[] {
  return hits.filter(h => {
    const key = TOGGLE_MAP[h.cat as keyof typeof TOGGLE_MAP];
    if (!key) return true;           // categories not controlled by dropdown stay visible
    return !!enabled[key];
  });
}

function mergeByPriority(hits: Hit[]): Hit[] {
       // Defensive: shape check
       const safe = hits.filter(
         (h: any) =>
           h &&
           typeof h.start === "number" &&
           typeof h.end === "number" &&
           typeof h.match === "string" &&
           typeof h.cat === "string"
       ) as Hit[];
     
       const pri = (c: Category) => {
         const i = ORDER.indexOf(c);
         return i === -1 ? 999 : i;
       };
       const len = (h: Hit) => h.end - h.start;
     
       // Sort by position first; tie-break by better category priority, then longer span
       const sorted = [...safe].sort((a, b) => {
         if (a.start !== b.start) return a.start - b.start;
         const pa = pri(a.cat), pb = pri(b.cat);
         if (pa !== pb) return pa - pb;
         return len(b) - len(a);
       });
     
       const out: Hit[] = [];
       for (const h of sorted) {
         if (out.length === 0) { out.push(h); continue; }
         const last = out[out.length - 1];
         if (h.start >= last.end) { out.push(h); continue; }
         
        //  const ETHOS_PREF = new Set(['evidence', 'weasel']);
        //  if (h.cat === 'ethos' && ETHOS_PREF.has(last.cat)) {
        //    out[out.length - 1] = h;
        //    continue;
        //  }

         // Overlap: keep the better span by category priority; tie-break by longer length
         const keepH =
           pri(h.cat) < pri(last.cat) ||
           (pri(h.cat) === pri(last.cat) && len(h) > len(last));
         if (keepH) out[out.length - 1] = h; // replace last with better span
         // else drop h
       }
      return out;
}

function renderWithHighlights(text: string, hits: Hit[]) {
  const parts: React.ReactNode[] = [];
  let i = 0;
  hits.forEach((h, idx) => {
    if (h.start > i) parts.push(<span key={`p-${i}`}>{text.slice(i, h.start)}</span>);
    parts.push(<Mark key={`m-${idx}`} hit={h} />);
    i = h.end;
  });
  if (i < text.length) parts.push(<span key={`tail-${i}`}>{text.slice(i)}</span>);
  return parts;
}

function Mark({ hit }: { hit: Hit }) {
  const base = 'px-0.5 rounded';
    const c = (hit as any)?.cat as string | undefined;
    const cls =
    c === 'hedge' ? 'bg-yellow-50 underline decoration-yellow-400' :
         c === 'booster' ? 'bg-rose-50 underline decoration-rose-400' :
         c === 'absolute' ? 'bg-amber-50 underline decoration-amber-400' :
         c?.startsWith('connective') ? 'bg-blue-50' :
         (c === 'analogy' || c === 'metaphor') ? 'bg-indigo-50' :
         c === 'weasel' ? 'bg-fuchsia-50' :
         c === 'evidence' ? 'bg-emerald-50' :
         c === 'ethos' ? 'bg-sky-50' :
         c === 'pathos' ? 'bg-pink-50' :
         c === 'logos' ? 'bg-green-50' :
         c === 'rhet-question' ? 'bg-purple-50' :
         c === 'allcaps' ? 'opacity-60' :
         c === 'affect-positive' ? 'bg-green-50 ring-1 ring-green-200' :
         c === 'affect-negative' ? 'bg-rose-50 ring-1 ring-rose-200' :
         c === 'frame-economic'  ? 'bg-blue-50 ring-1 ring-blue-200' :
         c === 'frame-morality'  ? 'bg-amber-50 ring-1 ring-amber-200' :
         c === 'frame-security'  ? 'bg-indigo-50 ring-1 ring-indigo-200' :
         c === 'frame-fairness'  ? 'bg-teal-50 ring-1 ring-teal-200' :
         c === 'frame-capacity'  ? 'bg-slate-50 ring-1 ring-slate-200' :
         c === 'imperative' ? 'bg-red-50 underline decoration-red-400' :
         c === 'passive' ? 'bg-neutral-50 ring-1 ring-neutral-200' :
         c === 'nominalization' ? 'bg-amber-50' :
         c === 'parallelism' ? 'bg-teal-50' :
         c === 'modal-certainty' ? 'bg-lime-50' :
         c === 'modal-uncertainty' ? 'bg-yellow-50' :
         c === 'negation' ? 'bg-purple-50' :
         c === 'pronoun-you' ? 'bg-sky-50' :
         c === 'pronoun-we' ? 'bg-sky-100' :
        c === 'exclaim' ? 'bg-orange-50' :
        c === 'inference-deductive' ? 'bg-green-50 ring-1 ring-green-200' :
        c === 'inference-inductive' ? 'bg-amber-50 ring-1 ring-amber-200' :
        c === 'inference-abductive' ? 'bg-sky-50 ring-1 ring-sky-200' :
    'bg-neutral-100';

  return (
    <span className={`${base} ${cls}`} title={c ?? ''}>
      {hit.match}
    </span>
  );
}
