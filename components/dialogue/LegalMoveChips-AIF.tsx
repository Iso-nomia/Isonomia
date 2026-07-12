// // components/dialogue/LegalMovesChips.tsx
// import React from 'react';

// type LegalMove = {
//   kind: 'ASSERT'|'WHY'|'GROUNDS'|'RETRACT'|'CONCEDE'|'CLOSE'|'THEREFORE'|'SUPPOSE'|'DISCHARGE';
//   label?: string;
//   disabled?: boolean;
//   reason?: string;
//   payload?: any;
// };

// type Props = {
//   atMoveId: string; // or some anchor describing the locus
//   onPick: (m: LegalMove) => void;
//   fetcher?: (atMoveId: string) => Promise<{ moves: LegalMove[] }>;
// };

// export function LegalMovesChips({ atMoveId, onPick, fetcher }: Props) {
//   const [moves, setMoves] = React.useState<LegalMove[]>([]);
//   const [loading, setLoading] = React.useState(false);

//   React.useEffect(() => {
//     let abort = new AbortController();
//     (fetcher
//       ? fetcher(atMoveId)
//       : fetch(`/api/dialogue/legal-moves?at=${encodeURIComponent(atMoveId)}`, { signal: abort.signal }).then(r => r.json())
//     )
//     .then(d => setMoves(d.moves ?? []))
//     .catch(() => void 0)
//     .finally(() => setLoading(false));
//     return () => abort.abort();
//   }, [atMoveId, fetcher]);

//   if (loading) return <span className="muted">Loading legal moves…</span>;

//   return (
//     <div className="chips">
//       {moves.map((m, i) => (
//         <button
//           key={i}
//           className={`chip ${m.disabled ? 'disabled' : ''}`}
//           title={m.disabled ? (m.reason || 'Not allowed here') : `Do ${m.kind}`}
//           onClick={() => !m.disabled && onPick(m)}
//           disabled={m.disabled}
//         >
//           {pretty(m)}
//         </button>
//       ))}
//       <style jsx>{`
//         .chips { display:flex; gap:6px; flex-wrap:wrap; }
//         .chip { border:1px solid #e5e7eb; border-radius:999px; padding:4px 10px; background:#fff; font-size:12px; }
//         .chip.disabled { opacity: .5; cursor:not-allowed; }
//         .muted { color:#6b7280; font-size:12px; }
//       `}</style>
//     </div>
//   );
// }

// function pretty(m: LegalMove) {
//   if (m.label) return m.label;
//   const map: Record<string, string> = {
//     ASSERT: 'Assert', WHY: 'Ask why', GROUNDS: 'Give grounds',
//     RETRACT: 'Retract', CONCEDE: 'Concede', CLOSE: 'Close',
//     THEREFORE: 'Therefore', SUPPOSE: 'Suppose', DISCHARGE: 'Discharge'
//   };
//   return map[m.kind] || m.kind;
// }
// components/dialogue/LegalMovesChips-AIF.tsx
import * as React from 'react';

type Props = { allowed: string[]; onPick: (kind: string) => void; };

export function LegalMovesChipsAIF({ allowed, onPick }: Props) {
  const all: Array<{k:string; label:string}> = [
    { k:'ASSERT', label:'Assert' },
    { k:'WHY', label:'Ask why' },
    { k:'GROUNDS', label:'Provide grounds' },
    { k:'REBUT', label:'Counter' },
    { k:'CONCEDE', label:'Concede' },
    { k:'RETRACT', label:'Retract' },
    { k:'CLOSE', label:'Close' },
  ];
  return (
    <div className="flex gap-2 flex-wrap">
      {all.map(m => (
        <button key={m.k} disabled={!allowed.includes(m.k)}
          className={`px-2 py-1 rounded-full text-xs ${allowed.includes(m.k) ? 'bg-indigo-100' : 'bg-gray-100 opacity-50'}`}
          onClick={()=>allowed.includes(m.k) && onPick(m.k)}>{m.label}</button>
      ))}
    </div>
  );
}
