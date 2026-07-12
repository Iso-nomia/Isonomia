'use client';
import * as React from 'react';
import QualityBadge, { qualityScore } from './QualityBadge';

export type QualityInputs = {
  hasUrl: boolean; hasDoi: boolean; hasNum: boolean; hasYear: boolean;
  toulmin: { grounds: boolean; warrant: boolean; claim: boolean };
  fallacyCount: number;
  cqSatisfied?: number;
  cqRequired?: number;
};

function detectSignals(text: string) {
  const hasUrl  = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/i.test(text);
  const hasDoi  = /(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i.test(text);
  const hasNum  = /\b\d{2,}\b/.test(text);
  const hasYear = /\b(19|20)\d{2}\b/.test(text);
  return { hasUrl, hasDoi, hasNum, hasYear };
}

export default function QualityBadgeBreakdown({
  argumentText,
  toulminPresence,
  fallacyCount = 0,
  cqSatisfied = 0,
  cqRequired = 0,
}: {
  argumentText: string;
  toulminPresence: { grounds: boolean; warrant: boolean; claim: boolean };
  fallacyCount?: number;
  cqSatisfied?: number;
  cqRequired?: number;
}) {
  const sig = detectSignals(argumentText);
  const base = qualityScore({
    ...sig,
    toulmin: toulminPresence,
    fallacyCount,
  });

  const bonus = cqRequired > 0 ? Math.min(10, Math.round((cqSatisfied / cqRequired) * 10)) : 0;
  const score = Math.min(100, base + bonus);

  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);


  return (
    <div className="inline-flex items-center gap-2">
      <div onClick={() => setOpen(o => !o)} className="cursor-pointer">
        <QualityBadge score={score} />
      </div>
      {open && (
        <div 
        ref={menuRef}

        className="absolute z-30 h-40 w-80 top-14 ml-2 rounded-xl border bg-white/50 backdrop-blur p-2 shadow-lg text-[12px] overflow-y-auto">
          <div className="font-semibold mb-1">Quality details</div>
          <ul className="space-y-1">
            <li>Grounds: {toulminPresence.grounds ? '✓' : '–'}</li>
            <li>Warrant: {toulminPresence.warrant ? '✓' : '–'}</li>
            <li>Claim: {toulminPresence.claim ? '✓' : '–'}</li>
            <li>URL: {sig.hasUrl ? '✓' : '–'} · DOI: {sig.hasDoi ? '✓' : '–'}</li>
            <li>Numbers: {sig.hasNum ? '✓' : '–'} · Year: {sig.hasYear ? '✓' : '–'}</li>
            <li>Fallacies detected: {fallacyCount}</li>
            <li>CQs satisfied: {cqSatisfied}/{cqRequired} (bonus +{bonus})</li>
          </ul>
          <div className="text-[11px] text-neutral-500 mt-2">Click badge to close.</div>
        </div>
      )}
    </div>
  );
}
