/**
 * Phase 5.1: Cross-field alerts panel
 */

"use client";

import { useState } from "react";
import {
  useAlerts,
  useUpdateAlert,
  useUnreadAlertCount,
} from "@/lib/crossfield/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  AlertTriangle,
  GitCompare,
  BookOpen,
  Check,
  Eye,
  X,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  CrossFieldAlertType,
  CrossFieldAlertStatus,
} from "@/lib/crossfield/types";

interface AlertsPanelProps {
  className?: string;
}

export function AlertsPanel({ className = "" }: AlertsPanelProps) {
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const { data: alerts, isLoading } = useAlerts(
    filter === "UNREAD" ? { status: "UNREAD" } : undefined
  );
  const { data: unreadCount } = useUnreadAlertCount();

  const { mutate: updateAlert } = useUpdateAlert();
  const markRead = (alertId: string) =>
    updateAlert({ alertId, action: "read" });
  const markActioned = (alertId: string) =>
    updateAlert({ alertId, action: "actioned" });
  const dismiss = (alertId: string) =>
    updateAlert({ alertId, action: "dismiss" });

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          <h3 className="font-semibold text-lg">Cross-Field Alerts</h3>
          {unreadCount != null && unreadCount > 0 && (
            <Badge className="bg-red-500 text-white">{unreadCount}</Badge>
          )}
        </div>

        {/* Filter toggles */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              filter === "ALL"
                ? "bg-white shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setFilter("ALL")}
          >
            All
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              filter === "UNREAD"
                ? "bg-white shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setFilter("UNREAD")}
          >
            Unread
          </button>
        </div>
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : !alerts || alerts.alerts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>
            {filter === "UNREAD"
              ? "No unread alerts"
              : "No cross-field alerts yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                alert.status === "UNREAD"
                  ? "bg-blue-50/50 border-blue-200"
                  : "bg-white border-gray-200"
              }`}
            >
              {/* Icon */}
              <div className="shrink-0 mt-0.5">
                <AlertTypeIcon type={alert.alertType} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm ${
                      alert.status === "UNREAD"
                        ? "font-medium text-gray-900"
                        : "text-gray-700"
                    }`}
                  >
                    {alert.title}
                  </p>
                  <StatusBadge status={alert.status} />
                </div>

                {/* Metadata row */}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {alert.sourceField && (
                    <span>
                      {alert.sourceField}
                      {alert.targetField && ` → ${alert.targetField}`}
                    </span>
                  )}
                  <span>
                    {formatDistanceToNow(new Date(alert.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                {/* Actions */}
                {alert.status === "UNREAD" && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => markRead(alert.id)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Mark read
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => markActioned(alert.id)}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Actioned
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-gray-400 hover:text-gray-600"
                      onClick={() => dismiss(alert.id)}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                )}

                {alert.status === "READ" && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => markActioned(alert.id)}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Actioned
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-gray-400 hover:text-gray-600"
                      onClick={() => dismiss(alert.id)}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertTypeIcon({ type }: { type: CrossFieldAlertType }) {
  switch (type) {
    case "SIMILAR_CLAIM":
      return <GitCompare className="w-4 h-4 text-blue-500" />;
    case "NEW_EQUIVALENCE":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "TRANSLATION_READY":
      return <Check className="w-4 h-4 text-green-500" />;
    case "FIELD_DISCUSSION":
      return <BookOpen className="w-4 h-4 text-purple-500" />;
    default:
      return <Bell className="w-4 h-4 text-gray-400" />;
  }
}

function StatusBadge({ status }: { status: CrossFieldAlertStatus }) {
  switch (status) {
    case "UNREAD":
      return (
        <Badge className="bg-blue-100 text-blue-800 text-[10px] shrink-0">
          NEW
        </Badge>
      );
    case "READ":
      return (
        <Badge variant="outline" className="text-[10px] shrink-0">
          Read
        </Badge>
      );
    case "ACTIONED":
      return (
        <Badge className="bg-green-100 text-green-800 text-[10px] shrink-0">
          Done
        </Badge>
      );
    case "DISMISSED":
      return (
        <Badge variant="outline" className="text-[10px] text-gray-400 shrink-0">
          Dismissed
        </Badge>
      );
  }
}
