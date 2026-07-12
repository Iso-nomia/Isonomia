// components/compose/TheoryFraming.tsx
'use client';
import * as React from 'react';
import PracticalBuilder from '../practical/PracticalBuilder';
import PracticalSummary from '../practical/PracticalSummary';
import HermeneuticBuilder from '../hermeneutic/HermeneuticBuilder';
import PascalBuilder from '../pascal/PascalBuilder';
import DNThesesEditor from '@/components/work/editors/DNThesesEditor';
import IHThesesEditor from '@/components/work/editors/IHThesesEditor';
import TCThesesEditor from '@/components/work/editors/TCThesesEditor';
import OPThesesEditor from '@/components/work/editors/OPThesesEditor';
import CompareAlternativesPanel from '@/components/work/CompareAlternativesPanel';

type TheoryType = 'DN'|'IH'|'TC'|'OP';

const THEORY_CONFIGS = {
  DN: {
    label: 'DN — Descriptive–Nomological',
    subtitle: 'empirical',
    description: 'Describe regularities, supply data & laws.',
    color: 'from-sky-500/10 to-sky-600/5',
    border: 'border-sky-200',
    badge: 'bg-sky-100 text-sky-700',
  },
  IH: {
    label: 'IH — Idealizing–Hermeneutic',
    subtitle: 'interpret → idealize',
    description: 'Interpret actual practice → propose an ideal standard.',
    color: 'from-purple-500/10 to-purple-600/5',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
  },
  TC: {
    label: 'TC — Technical–Constructive',
    subtitle: 'design an instrument',
    description: 'Design an instrument to realize the standard output.',
    color: 'from-emerald-500/10 to-emerald-600/5',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  OP: {
    label: 'OP — Ontic–Practical',
    subtitle: 'as‑if decision under uncertainty',
    description: 'As-if decision under uncertainty; justify a necessary assumption.',
    color: 'from-amber-500/10 to-amber-600/5',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  },
};

export function TheoryFraming({
  value,
  onChange,
  workId,
  canEditPractical = true,
  defaultOpenBuilder = false,
  className = '',
}: {
  value: { theoryType: TheoryType; standardOutput?: string };
  onChange: (v: { theoryType: TheoryType; standardOutput?: string }) => void;
  workId?: string;
  canEditPractical?: boolean;
  defaultOpenBuilder?: boolean;
  className?: string;
}) {
  const t = (value?.theoryType ?? 'DN') as TheoryType;
  const config = THEORY_CONFIGS[t];

  return (
    <div className={`rounded-lg max-w-[2000px] w-full  border bg-white shadow-sm ${className}`}>
      {/* Header */}
      <div className="rounded-xl px-4 py-3 border-b bg-gradient-to-r from-neutral-50 to-white">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Argument Framing</h3>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${config.badge}`}>
            {t}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Theory Type Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-700">
            Theory Type
          </label>
          
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(THEORY_CONFIGS) as TheoryType[]).map((type) => {
              const cfg = THEORY_CONFIGS[type];
              const isSelected = t === type;
              
              return (
                <button
                  key={type}
                  onClick={() => onChange({ ...value, theoryType: type })}
                  className={`
                    relative p-3 rounded-lg border-2 text-left transition-all
                    ${isSelected 
                      ? `${cfg.border} bg-gradient-to-br ${cfg.color} shadow-sm` 
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-neutral-900 leading-tight">
                        {type}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5 leading-tight">
                        {cfg.subtitle}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-current" 
                           style={{ color: cfg.badge.match(/text-(\w+)-700/)?.[0].replace('text-', '') }} 
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-neutral-600 leading-relaxed pl-0.5">
            {config.description}
          </p>
        </div>

        {/* Standard Output (for IH/TC) */}
        {(t === 'IH' || t === 'TC') && (
          <div className={`p-3 rounded-lg border ${config.border} bg-gradient-to-br ${config.color}`}>
            <label className="block text-xs font-medium text-neutral-700 mb-2">
              Standard Output
              <span className="ml-1 text-neutral-500 font-normal">(purpose of the instrument)</span>
            </label>
            <input
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-shadow"
              value={value.standardOutput ?? ''}
              onChange={(e) => onChange({ ...value, standardOutput: e.target.value })}
              placeholder="e.g., Maximize public health while preserving autonomy"
            />
            <p className="mt-2 text-[10px] text-neutral-600 leading-relaxed">
              This is the "key to all further findings" (Lumer TIH9/TTC2).
            </p>
          </div>
        )}

        {/* Structured Builders */}
        {!workId ? (
          <div className="p-4 rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50/50 text-center">
            <p className="text-xs text-neutral-600">
              Save this work to enable structured builders for <span className="font-semibold">{t}</span>
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />
            
            {t === 'IH' && (
              <>
                <HermeneuticBuilder workId={workId} />
                <IHThesesEditor workId={workId} />
                <CompareAlternativesPanel workId={workId} />
                <PracticalSummary workId={workId} />
                {canEditPractical && (
                  <PracticalBuilder workId={workId} defaultOpen={defaultOpenBuilder} />
                )}
              </>
            )}

            {t === 'TC' && (
              <>
                <TCThesesEditor workId={workId} />
                <CompareAlternativesPanel workId={workId} />
                <PracticalSummary workId={workId} />
                {canEditPractical && (
                  <PracticalBuilder workId={workId} defaultOpen={defaultOpenBuilder} />
                )}
                <p className="text-[10px] text-neutral-500 italic px-3 py-2 bg-neutral-50 rounded">
                  Optional: Use the Hermeneutic builder if you want to ground your construction in interpreted practice.
                </p>
              </>
            )}

            {t === 'OP' && (
              <>
                <OPThesesEditor workId={workId} />
                <PascalBuilder workId={workId} />
              </>
            )}

            {t === 'DN' && (
              <>
                <DNThesesEditor workId={workId} />
                <p className="text-[10px] text-neutral-500 px-3 py-2 bg-sky-50/50 rounded border border-sky-100">
                  DN posts supply empirical premises. Link them later via the Supply function graph.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}