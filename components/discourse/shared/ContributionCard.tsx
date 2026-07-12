// components/discourse/shared/ContributionCard.tsx
"use client";

import * as React from "react";
import { FileText, MessageSquare, CheckCircle2, ArrowRight, Lightbulb } from "lucide-react";

interface ContributionCardProps {
  type: "claim" | "argument" | "proposition";
  id: string;
  text: string;
  createdAt: string;
  deliberationId: string;
  // Additional props for propositions
  voteUpCount?: number;
  voteDownCount?: number;
  endorseCount?: number;
  status?: string;
}

const typeConfig = {
  claim: { icon: FileText, color: "text-sky-600", bg: "bg-sky-50", label: "Claim" },
  argument: { icon: MessageSquare, color: "text-indigo-600", bg: "bg-indigo-50", label: "Argument" },
  proposition: { icon: Lightbulb, color: "text-green-600", bg: "bg-green-50", label: "Proposition" },
};

export function ContributionCard({ 
  type, 
  id, 
  text, 
  createdAt, 
  voteUpCount,
  voteDownCount,
  endorseCount,
  status 
}: ContributionCardProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.bg}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
            {status && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                status === "PUBLISHED" ? "bg-green-100 text-green-700" :
                status === "DRAFT" ? "bg-slate-100 text-slate-600" :
                "bg-amber-100 text-amber-700"
              }`}>
                {status}
              </span>
            )}
            <span className="text-xs text-slate-500">
              {new Date(createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-slate-700 line-clamp-2">{text}</p>
          
          {/* Proposition stats */}
          {type === "proposition" && (voteUpCount !== undefined || endorseCount !== undefined) && (
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              {voteUpCount !== undefined && (
                <span className="flex items-center gap-1">
                  👍 {voteUpCount}
                </span>
              )}
              {voteDownCount !== undefined && (
                <span className="flex items-center gap-1">
                  👎 {voteDownCount}
                </span>
              )}
              {endorseCount !== undefined && endorseCount > 0 && (
                <span className="flex items-center gap-1">
                  ✓ {endorseCount} endorsements
                </span>
              )}
            </div>
          )}
        </div>
        <button className="text-indigo-600 hover:text-indigo-700 text-xs flex items-center gap-1">
          View <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
