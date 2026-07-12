'use client';
import React from 'react';
import { useSequentStatus } from './useSequentStatus';
import { useNliSequent } from './useNliSequent';


export default function SequentBadge({
  gammaTexts,
  deltaTexts,
  onClick,
}: {
  gammaTexts: string[];
  deltaTexts: string[];
  onClick?: () => void;
}) {
  const { sequent, isValidating } = useSequentStatus({ gammaTexts, deltaTexts });
  const { summary, isLoading } = useNliSequent(gammaTexts, deltaTexts);
  if (isLoading) return <span className="text-[11px] text-neutral-500">Entailment: …</span>;
  if (!summary) return null;
  const { label, sequentEntail } = sequent;


  const gN = gammaTexts.length, dN = deltaTexts.length;
  const color =
    summary.verdict === 'strong' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : summary.verdict === 'weak' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';



  const style = label === 'strong'
    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
    : label === 'weak'
    ? 'bg-amber-50 border-amber-300 text-amber-800'
    : 'bg-rose-50 border-rose-300 text-rose-700';

    return (
      <button
        onClick={onClick}
        className={`text-[11px] px-1.5 py-0.5 rounded border ${color}`}
        title={`Γ=${gN}, Δ=${dN}; min entail=${summary.perDelta.length ? Math.min(...summary.perDelta.map(d=>d.entailMax)).toFixed(2) : '0'}; max contra=${summary.perDelta.length ? Math.max(...summary.perDelta.map(d=>d.contraMax)).toFixed(2) : '0'}`}
      >
        ⊢ {gN}→{dN} · Entailment: {summary.verdict}
      </button>
    );
  }