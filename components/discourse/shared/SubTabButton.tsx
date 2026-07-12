// components/discourse/shared/SubTabButton.tsx
"use client";

import * as React from "react";

interface SubTabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  highlight?: boolean;
  role?: string;
  "aria-selected"?: boolean;
  tabIndex?: number;
}

export function SubTabButton({ 
  active, 
  onClick, 
  label, 
  count, 
  highlight,
  role = "tab",
  "aria-selected": ariaSelected,
  tabIndex,
}: SubTabButtonProps) {
  return (
    <button
      onClick={onClick}
      role={role}
      aria-selected={ariaSelected ?? active}
      tabIndex={tabIndex ?? (active ? 0 : -1)}
      className={`
        px-3 py-1.5 text-xs font-medium rounded-md transition-colors
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1
        ${active 
          ? highlight
            ? "bg-amber-100 text-amber-800"
            : "bg-indigo-100 text-indigo-700"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }
      `}
    >
      {label}
      {count !== undefined && (
        <span className="ml-1.5 text-xs opacity-75" aria-label={`${count} items`}>
          ({count})
        </span>
      )}
    </button>
  );
}
