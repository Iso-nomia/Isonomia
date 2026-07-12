// components/ludics/ArgumentSchemeView.tsx
'use client';

import * as React from 'react';

type SemanticAnnotation = 
  | { type: 'claim'; claimId: string; text: string; moid?: string | null }
  | { 
      type: 'argument'; 
      argumentId: string;
      scheme?: { key?: string; name?: string; purpose?: string; materialRelation?: string } | null;
      premises: Array<{ claimId?: string; text?: string }>;
      conclusion?: { claimId?: string; text?: string } | null;
    };

type EnrichedAct = {
  id: string;
  kind: string;
  polarity?: string | null;
  expression?: string;
  locusPath?: string;
  isAdditive?: boolean;
  semantic?: SemanticAnnotation | null;
};

type Props = {
  acts: EnrichedAct[];
  participantId: string;
};

/**
 * ArgumentSchemeView
 * Displays the argumentative structure of a design:
 * - Claims made by the participant
 * - Arguments with their schemes, premises, and conclusions
 */
export function ArgumentSchemeView({ acts, participantId }: Props) {
  // Group semantic annotations
  const claims = React.useMemo(() => {
    const seen = new Set<string>();
    return acts
      .filter(a => a.semantic?.type === 'claim')
      .map(a => a.semantic as Extract<SemanticAnnotation, { type: 'claim' }>)
      .filter(c => {
        if (seen.has(c.claimId)) return false;
        seen.add(c.claimId);
        return true;
      });
  }, [acts]);

  const argumentsData = React.useMemo(() => {
    const seen = new Set<string>();
    return acts
      .filter(a => a.semantic?.type === 'argument')
      .map(a => a.semantic as Extract<SemanticAnnotation, { type: 'argument' }>)
      .filter(arg => {
        if (seen.has(arg.argumentId)) return false;
        seen.add(arg.argumentId);
        return true;
      });
  }, [acts]);

  const isProp = participantId === 'Proponent';

  if (claims.length === 0 && argumentsData.length === 0) {
    return (
      <div className="argument-scheme-view p-4 text-sm text-slate-500">
        No semantic annotations available
      </div>
    );
  }

  return (
    <div className="argument-scheme-view space-y-1 px-2">
      {/* Header */}
      <div className={`flex items-center gap-2 pb-1 border-b ${
        isProp ? 'border-emerald-200' : 'border-rose-200'
      }`}>
        <div className={`text-xs font-semibold ${
          isProp ? 'text-emerald-700' : 'text-rose-700'
        }`}>
          {participantId}'s Arguments
        </div>
      </div>

      {/* Claims Section */}
      {claims.length > 0 && (
        <div className="claims-section">
          <h3 className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-2">
            
            Claims ({claims.length})
          </h3>
          <div className="space-y-1">
            {claims.map((claim, i) => (
              <div
                key={claim.claimId}
                className={`p-1 rounded-lg border ${
                  isProp 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : 'bg-rose-50 border-rose-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-mono text-slate-500 mt-0.5">
                    {i + 1}.
                  </span>
                  <div className="flex-1">
                    <div className="text-xs text-slate-800">{claim.text}</div>
                    {claim.moid && (
                      <div className="text-[10px] text-slate-500 mt-.5 font-mono">
                        {claim.moid}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arguments Section */}
      {argumentsData.length > 0 && (
        <div className="arguments-section">
          <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <span className="text-lg">䷦</span>
            Structured Arguments ({argumentsData.length})
          </h3>
          <div className="space-y-4">
            {argumentsData.map((arg, i) => (
              <div
                key={arg.argumentId}
                className={`p-4 rounded-lg border-2 ${
                  isProp 
                    ? 'bg-emerald-50/50 border-emerald-300' 
                    : 'bg-rose-50/50 border-rose-300'
                }`}
              >
                {/* Argument header with scheme */}
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-xs font-mono text-slate-500 mt-0.5">
                    {i + 1}.
                  </span>
                  <div className="flex-1">
                    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-semibold ${
                      isProp ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
                    }`}>
                      <span>⛭</span>
                      <span>{arg.scheme?.name || arg.scheme?.key || 'Unknown Scheme'}</span>
                    </div>
                    {arg.scheme?.materialRelation && (
                      <div className="text-xs text-slate-600 mt-1">
                        Relation: <span className="font-mono">{arg.scheme.materialRelation}</span>
                      </div>
                    )}
                    {arg.scheme?.purpose && (
                      <div className="text-xs text-slate-600">
                        Purpose: <span className="font-mono">{arg.scheme.purpose}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Premises */}
                {arg.premises.length > 0 && (
                  <div className="ml-5 mb-3">
                    <div className="text-xs font-semibold text-slate-600 mb-1.5">
                      Premises:
                    </div>
                    <div className="space-y-1.5">
                      {arg.premises.map((premise, pi) => (
                        <div
                          key={pi}
                          className="flex items-start gap-2 p-2 rounded bg-white/80 border border-slate-200"
                        >
                          <span className="text-xs text-slate-400 mt-0.5">P{pi + 1}:</span>
                          <div className="flex-1 text-sm text-slate-700">
                            {premise.text || <em className="text-slate-400">No text</em>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conclusion */}
                {arg.conclusion?.text && (
                  <div className="ml-5">
                    <div className="text-xs font-semibold text-slate-600 mb-1.5">
                      Conclusion:
                    </div>
                    <div className={`p-2 rounded border-2 ${
                      isProp 
                        ? 'bg-emerald-100 border-emerald-400' 
                        : 'bg-rose-100 border-rose-400'
                    }`}>
                      <div className="text-sm font-medium text-slate-800">
                        𐬽 {arg.conclusion.text}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
