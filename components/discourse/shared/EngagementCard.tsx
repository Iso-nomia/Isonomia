// components/discourse/shared/EngagementCard.tsx
"use client";

import * as React from "react";
import { Swords, AlertCircle, MessageSquare, ThumbsUp, ArrowRight } from "lucide-react";

interface EngagementCardProps {
  type: "attack" | "challenge" | "response" | "vote";
  data: any;
  deliberationId: string;
}

const typeConfig = {
  attack: { icon: Swords, color: "text-red-600", bg: "bg-red-50", label: "Attack" },
  challenge: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", label: "Challenge (WHY)" },
  response: { icon: MessageSquare, color: "text-sky-600", bg: "bg-sky-50", label: "Response (GROUNDS)" },
  vote: { icon: ThumbsUp, color: "text-green-600", bg: "bg-green-50", label: "Vote" },
};

export function EngagementCard({ type, data }: EngagementCardProps) {
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
            <span className="text-xs text-slate-500">
              {new Date(data.createdAt || Date.now()).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-slate-700">
            {type === "attack" && `${data.legacyAttackType} attack on ${data.targetType}: "${data.targetText || "Unknown"}"`}
            {type === "challenge" && `Challenged: "${data.targetText || "Unknown"}"`}
            {type === "response" && `Responded with GROUNDS: "${data.groundsText || data.payload?.text || "..."}"`}
          </p>
        </div>
        <button className="text-indigo-600 hover:text-indigo-700 text-xs flex items-center gap-1">
          View <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
