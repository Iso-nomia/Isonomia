// components/discourse/shared/EmptyState.tsx
"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div 
      className="text-center py-12"
      role="status"
      aria-label={`${title}. ${description}`}
    >
      <div 
        className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4"
        aria-hidden="true"
      >
        <Icon className="w-6 h-6 text-slate-400" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}
