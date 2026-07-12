// // components/rhetoric/StyleDensityBadge.tsx
// 'use client';
// import { useMemo, useState } from 'react';
// import { computeStyleCounts, per100, SOFT_ALTS } from '@/components/rhetoric/styleStats';

// export default function StyleDensityBadge({ text }: { text: string }) {
//   const [open, setOpen] = useState(false);
//   const stats = useMemo(()=>computeStyleCounts(text), [text]);
//   const value = per100(stats); // marks per 100 words
//   const topTerms = Object.keys(SOFT_ALTS).filter(t => new RegExp(`\\b${t}\\b`, 'i').test(text)).slice(0,2);

//   return (
//     <div className="relative inline-block">
//       <span
//         className="text-[11px] px-1.5 py-0.5 rounded border bg-neutral-50 text-neutral-700 cursor-default"
//         onMouseEnter={()=>setOpen(true)}
//         onMouseLeave={()=>setOpen(false)}
//         title="Rhetorical style marks per 100 words"
//       >
//         Style density: <b>{value}</b>
//       </span>
//       {open && (
//         <div className="absolute z-20 mt-1 w-64 text-xs bg-white border rounded shadow p-2">
//           <div className="mb-1 font-medium">Breakdown</div>
//           <ul className="space-y-0.5">
//             <li>Hedges: {stats.hedges}</li>
//             <li>Boosters: {stats.boosters}</li>
//             <li>Absolutes: {stats.absolutes}</li>
//             <li>Analogy cues: {stats.analogy}</li>
//             <li>Metaphor cues: {stats.metaphor}</li>
//             <li>ALL‑CAPS tokens: {stats.allCaps}</li>
//             <li>Rhetorical questions: {stats.rq}</li>
//           </ul>
//           {!!topTerms.length && (
//             <>
//               <div className="mt-2 mb-1 font-medium">Softer alternatives</div>
//               <ul className="list-disc ml-4">
//                 {topTerms.map(t => (
//                   <li key={t}><b>{t}</b> → {SOFT_ALTS[t].join(', ')}</li>
//                 ))}
//               </ul>
//             </>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }
'use client';
import * as React from 'react';
import { analyzeMany, densityPer100 } from './detectors';

export default function StyleDensityBadge({ texts }: { texts: string[] }) {
  const a = React.useMemo(() => analyzeMany(texts.filter(Boolean)), [texts]);
  const d = densityPer100(a);
  const boosters = a.counts['booster'] || 0;
  const hedges = a.counts['hedge'] || 0;
  const absolutes = a.counts['absolute'] || 0;

  return (
    <div className="inline-flex text-[11px] px-2 py-0.5 rounded border bg-white/70 text-neutral-700"
         title={`Style density: ${d} marks/100w • boosters:${boosters} hedges:${hedges} absolutes:${absolutes}`}>
      Style {d}/100w
    </div>
  );
}
