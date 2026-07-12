// components/discourse/shared/TabButton.tsx
"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  badge?: string;
  role?: string;
  "aria-selected"?: boolean;
  tabIndex?: number;
  id?: string;
  "aria-controls"?: string;
}

export function TabButton({ 
  active, 
  onClick, 
  icon: Icon, 
  label, 
  badge,
  role = "tab",
  "aria-selected": ariaSelected,
  tabIndex,
  id,
  "aria-controls": ariaControls,
}: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      role={role}
      aria-selected={ariaSelected ?? active}
      tabIndex={tabIndex ?? (active ? 0 : -1)}
      id={id}
      aria-controls={ariaControls}
      className={`
        flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
        focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500
        ${active 
          ? "border-indigo-600 text-indigo-600" 
          : "border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300"
        }
      `}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      {label}
      {badge && (
        <span 
          className="ml-1 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full"
          aria-label={`${badge} pending`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
