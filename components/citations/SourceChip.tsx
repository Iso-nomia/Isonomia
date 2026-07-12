// components/citations/SourceChip.tsx
export function SourceChip({ text, onClick }: { text: string; onClick?:()=>void }) {
    return <button className="text-[11px] px-1.5 py-0.5 rounded border bg-white hover:bg-slate-50"
                   title={text} onClick={onClick}>{text.slice(0, 48)}</button>;
  }
  