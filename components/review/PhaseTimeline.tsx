/**
 * Visual timeline showing review phases and their status
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Check, Circle, Clock, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Phase {
  id: string;
  name: string;
  description: string;
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "SKIPPED";
  startedAt?: string;
  completedAt?: string;
}

interface PhaseTimelineProps {
  phases: Phase[];
  currentPhaseId?: string;
}

const statusConfig: Record<
  Phase["status"],
  { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }
> = {
  PENDING: {
    icon: Circle,
    color: "text-gray-400",
    bgColor: "bg-gray-100",
  },
  ACTIVE: {
    icon: Clock,
    color: "text-blue-500",
    bgColor: "bg-blue-100",
  },
  COMPLETED: {
    icon: Check,
    color: "text-green-500",
    bgColor: "bg-green-100",
  },
  SKIPPED: {
    icon: AlertCircle,
    color: "text-yellow-500",
    bgColor: "bg-yellow-100",
  },
};

export function PhaseTimeline({ phases, currentPhaseId }: PhaseTimelineProps) {
  return (
    <TooltipProvider>
      <div className="relative">
        {/* Horizontal timeline for desktop */}
        <div className="hidden md:block">
          <div className="flex justify-between">
            {phases.map((phase, index) => {
              const config = statusConfig[phase.status];
              const Icon = config.icon;
              const isCurrent = phase.id === currentPhaseId;

              return (
                <div key={phase.id} className="flex-1 relative">
                  {/* Connector line */}
                  {index < phases.length - 1 && (
                    <div
                      className={cn(
                        "absolute top-4 left-1/2 w-full h-0.5",
                        phase.status === "COMPLETED"
                          ? "bg-green-300"
                          : "bg-gray-200"
                      )}
                    />
                  )}

                  {/* Phase node */}
                  <div className="flex flex-col items-center relative z-10">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            config.bgColor,
                            isCurrent && "ring-2 ring-blue-500 ring-offset-2"
                          )}
                        >
                          <Icon className={cn("w-4 h-4", config.color)} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{phase.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {phase.description}
                        </p>
                        {phase.startedAt && (
                          <p className="text-xs mt-1">
                            Started:{" "}
                            {new Date(phase.startedAt).toLocaleDateString()}
                          </p>
                        )}
                        {phase.completedAt && (
                          <p className="text-xs">
                            Completed:{" "}
                            {new Date(phase.completedAt).toLocaleDateString()}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>

                    <span
                      className={cn(
                        "mt-2 text-xs text-center max-w-[100px]",
                        isCurrent
                          ? "font-semibold text-blue-600"
                          : "text-muted-foreground"
                      )}
                    >
                      {phase.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vertical timeline for mobile */}
        <div className="block md:hidden space-y-4">
          {phases.map((phase, index) => {
            const config = statusConfig[phase.status];
            const Icon = config.icon;
            const isCurrent = phase.id === currentPhaseId;

            return (
              <div key={phase.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      config.bgColor,
                      isCurrent && "ring-2 ring-blue-500 ring-offset-2"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  {index < phases.length - 1 && (
                    <div
                      className={cn(
                        "w-0.5 flex-1 min-h-[24px]",
                        phase.status === "COMPLETED"
                          ? "bg-green-300"
                          : "bg-gray-200"
                      )}
                    />
                  )}
                </div>

                <div className="flex-1 pb-4">
                  <p
                    className={cn(
                      "font-medium",
                      isCurrent ? "text-blue-600" : ""
                    )}
                  >
                    {phase.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {phase.description}
                  </p>
                  {phase.startedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Started:{" "}
                      {new Date(phase.startedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
