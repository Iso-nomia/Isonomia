// components/discourse/shared/StatCard.tsx
"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  color: "sky" | "indigo" | "green" | "red" | "amber" | "orange" | "purple";
}

const colorClasses = {
  sky: "bg-sky-50 border-sky-200 text-sky-700",
  indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
  green: "bg-green-50 border-green-200 text-green-700",
  red: "bg-red-50 border-red-200 text-red-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  orange: "bg-orange-50 border-orange-200 text-orange-700",
  purple: "bg-purple-50 border-purple-200 text-purple-700",
};

export function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div 
      className={`p-4 border rounded-lg ${colorClasses[color]}`}
      role="status"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" aria-hidden="true" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold" aria-hidden="true">{value}</div>
    </div>
  );
}
