// components/evidence/EvalModeToggle.tsx
"use client";
import * as React from 'react';

export function EvalModeToggle({ value, onChange }:{ value:'min'|'prod'|'logodds'; onChange:(v:any)=>void }) {
  return (
    <div className="inline-flex border rounded overflow-hidden">
      {(['min','prod','logodds'] as const).map(m => (
        <button key={m}
          onClick={()=>onChange(m)}
          className={`px-2 py-1 text-xs ${value===m?'bg-slate-900 text-white':'bg-white hover:bg-slate-50'}`}>
          {m.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
