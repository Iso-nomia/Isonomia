'use client';
import { diffWords } from '@/lib/diff/diffWords';

export default function DiffSection({ left, right }: { left: string; right: string }) {
  const parts = diffWords(left || '', right || '');
  return (
    <div className="text-sm leading-6">
      {parts.map((p, idx) => {
        if (p.type === 'same') return <span key={idx}>{p.text} </span>;
        if (p.type === 'add') return <mark key={idx} className="bg-emerald-100 rounded px-0.5">{p.text} </mark>;
        return <mark key={idx} className="bg-rose-100 rounded px-0.5 line-through decoration-rose-600">{p.text} </mark>;
      })}
    </div>
  );
}
