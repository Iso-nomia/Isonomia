// components/discourse/shared/ActivityCard.tsx
"use client";

import * as React from "react";
import { 
  Swords, 
  AlertCircle, 
  MessageSquare, 
  FileText, 
  Users 
} from "lucide-react";

interface ActivityCardProps {
  activity: {
    id: string;
    type: string;
    description: string;
    targetText?: string;
    createdAt: string | Date;
  };
}

const typeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  attack_received: { icon: Swords, color: "text-red-600", bg: "bg-red-50" },
  attack_created: { icon: Swords, color: "text-red-500", bg: "bg-red-50" },
  challenge_received: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" },
  challenge_created: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50" },
  response_received: { icon: MessageSquare, color: "text-sky-600", bg: "bg-sky-50" },
  response_created: { icon: MessageSquare, color: "text-sky-500", bg: "bg-sky-50" },
  claim_created: { icon: FileText, color: "text-indigo-600", bg: "bg-indigo-50" },
  argument_created: { icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-50" },
  proposition_created: { icon: FileText, color: "text-green-600", bg: "bg-green-50" },
};

export function ActivityCard({ activity }: ActivityCardProps) {
  const config = typeConfig[activity.type] || { icon: Users, color: "text-slate-600", bg: "bg-slate-50" };
  const Icon = config.icon;

  // Determine if this is an incoming action (needs attention)
  const isIncoming = activity.type.endsWith("_received");

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${isIncoming ? "border-l-4 border-l-amber-400 bg-white border-slate-200" : "bg-slate-50 border-transparent"}`}>
      <div className={`p-2 rounded-lg ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700">{activity.description}</p>
        {activity.targetText && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic">
            &quot;{activity.targetText}&quot;
          </p>
        )}
        <span className="text-xs text-slate-400 mt-1 block">
          {new Date(activity.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {isIncoming && (
        <div className="flex-shrink-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
            New
          </span>
        </div>
      )}
    </div>
  );
}
