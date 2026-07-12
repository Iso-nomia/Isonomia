// app/deliberation/[id]/dialoguetimeline/page.tsx
"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sword,
  Scale,
  ArrowRight,
  Loader2,
  User,
  Clock,
  Filter,
  Download,
  Calendar,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface TimelineEvent {
  id: string;
  type: "dialogue_move" | "argument_created" | "conflict_created" | "preference_created";
  timestamp: string;
  actorId: string;
  actorName: string;
  data: any;
}

interface DialogueMove {
  id: string;
  kind: string;
  actorId: string;
  targetType: string | null;
  targetId: string | null;
  payload: any;
  createdAt: string;
}

interface DialogueThread {
  id: string;
  initiatingMove: DialogueMove;
  responses: DialogueMove[];
  isExpanded?: boolean;
}

/**
 * Group dialogue moves into threads based on target relationships
 * A thread is a WHY/CHALLENGE followed by its responses (GROUNDS, CONCEDE, etc.)
 */
function groupMovesIntoThreads(moves: DialogueMove[]): (DialogueMove | DialogueThread)[] {
  const result: (DialogueMove | DialogueThread)[] = [];
  const processedIds = new Set<string>();

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    
    if (processedIds.has(move.id)) continue;

    // Check if this is a threadable initiating move (WHY, CHALLENGE)
    if (move.kind === "WHY" || move.kind === "CHALLENGE") {
      const responses: DialogueMove[] = [];
      
      // Look ahead for responses targeting this move's target
      for (let j = i + 1; j < moves.length && j < i + 10; j++) {
        const potentialResponse = moves[j];
        
        // Check if it's a response to the same target
        if (
          potentialResponse.targetId === move.targetId &&
          potentialResponse.targetType === move.targetType &&
          (potentialResponse.kind === "GROUNDS" ||
           potentialResponse.kind === "CONCEDE" ||
           potentialResponse.kind === "RETRACT" ||
           potentialResponse.kind === "ASSERT")
        ) {
          responses.push(potentialResponse);
          processedIds.add(potentialResponse.id);
        }
      }

      // Create thread if we found responses
      if (responses.length > 0) {
        result.push({
          id: `thread-${move.id}`,
          initiatingMove: move,
          responses,
          isExpanded: false,
        });
        processedIds.add(move.id);
      } else {
        result.push(move);
        processedIds.add(move.id);
      }
    } else {
      result.push(move);
      processedIds.add(move.id);
    }
  }

  return result;
}

/**
 * Get icon and color for dialogue move types
 */
function getMoveIcon(kind: string) {
  const iconMap: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    ASSERT: {
      icon: <MessageSquare className="h-4 w-4" />,
      color: "bg-sky-500",
      label: "Asserted",
    },
    WHY: {
      icon: <HelpCircle className="h-4 w-4" />,
      color: "bg-amber-500",
      label: "Questioned",
    },
    GROUNDS: {
      icon: <FileText className="h-4 w-4" />,
      color: "bg-green-500",
      label: "Provided Grounds",
    },
    CONCEDE: {
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: "bg-emerald-500",
      label: "Conceded",
    },
    RETRACT: {
      icon: <XCircle className="h-4 w-4" />,
      color: "bg-red-500",
      label: "Retracted",
    },
    CONFLICT: {
      icon: <Sword className="h-4 w-4" />,
      color: "bg-rose-500",
      label: "Conflicted",
    },
    PREFER: {
      icon: <Scale className="h-4 w-4" />,
      color: "bg-purple-500",
      label: "Preferred",
    },
    THEREFORE: {
      icon: <ArrowRight className="h-4 w-4" />,
      color: "bg-indigo-500",
      label: "Concluded",
    },
  };

  return (
    iconMap[kind] || {
      icon: <MessageSquare className="h-4 w-4" />,
      color: "bg-gray-500",
      label: kind,
    }
  );
}

/**
 * Format target text for display
 */
function formatTargetText(move: DialogueMove, claimTexts: Map<string, string>, argTexts: Map<string, string>) {
  if (!move.targetId || !move.targetType) {
    return null;
  }

  if (move.targetType === "claim") {
    const text = claimTexts.get(move.targetId);
    return text ? (
      <span className="text-xs  text-gray-700 italic">
        &ldquo;{text.length > 80 ? text.slice(0, 80) + "..." : text}&rdquo;
      </span>
    ) : (
      <span className="text-xs px-3 text-gray-700 font-mono">{move.targetId.slice(0, 18)}...</span>
    );
  }

  if (move.targetType === "argument") {
    const text = argTexts.get(move.targetId);
    return text ? (
      <span className="text-xs text-gray-700 italic">
        &ldquo;{text.length > 80 ? text.slice(0, 80) + "..." : text}&rdquo;
      </span>
    ) : (
      <span className="text-xs px-3 text-gray-700  font-mono">{move.targetId.slice(0, 18)}...</span>
    );
  }

  return <span className="text-xs text-gray-500">{move.targetType}</span>;
}

/**
 * Timeline Event Card Component
 */
function TimelineEventCard({
  move,
  isFirst,
  isLast,
  claimTexts,
  argTexts,
  userNames,
}: {
  move: DialogueMove;
  isFirst: boolean;
  isLast: boolean;
  claimTexts: Map<string, string>;
  argTexts: Map<string, string>;
  userNames: Map<string, string>;
}) {
  const moveInfo = getMoveIcon(move.kind);
  const timestamp = new Date(move.createdAt);

  return (
    <div className="flex gap-4 group">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        {/* Dot */}
        <div
          className={`${moveInfo.color} w-3 h-3 rounded-full ring-4 ring-white shadow-md transition-transform group-hover:scale-125`}
        />
        {/* Vertical line */}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gray-200 mt-1" style={{ minHeight: "60px" }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <Card className="sidebarv2 group-hover:shadow-md transition-shadow">
          <CardContent className="p-3">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`${moveInfo.color} p-2 rounded-lg text-white`}>
                  {moveInfo.icon}
                </div>
                <div>
                  <div className="font-semibold text-base text-gray-900">{moveInfo.label}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    <span>{userNames.get(move.actorId) || `User ${String(move.actorId).slice(0, 18)}...`}</span>
                    <span>•</span>
                    <Clock className="h-3 w-3" />
                    <span>{format(timestamp, "MMM d, yyyy 'at' h:mm a")}</span>
                  </div>
                </div>
              </div>
              <Badge  className="bg-indigo-800 hover:bg-indigo-800 text-[10px]">
                {move.kind}
              </Badge>
            </div>

            {/* Target content */}
            {move.targetId && (
              <div className="mt-0 py-2 px-4 text-xs surfacev2 bg-white border-none rounded-lg ring-none outline-none shadow-md hover:translate-y-0 hover:shadow-md">
                <div className="text-[10px] mb-2 text-gray-700 bg-white/70 border border-indigo-300 px-1 w-fit rounded">
                  Target: {move.targetType}
                </div>
                {formatTargetText(move, claimTexts, argTexts)}
              </div>
            )}

            {/* Payload details */}
            {move.payload && Object.keys(move.payload).length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-gray-500 ml-2 cursor-pointer hover:text-gray-700">
                  <span className="ml-1">View details</span>
                </summary>
                <pre className="mt-2 text-xs  px-4 py-4  rounded-lg drop-shadow-white overflow-x-auto">
                  {JSON.stringify(move.payload, null, 2)}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Thread Card Component - Groups related moves together
 */
function ThreadCard({
  thread,
  isExpanded,
  onToggle,
  claimTexts,
  argTexts,
  userNames,
}: {
  thread: DialogueThread;
  isExpanded: boolean;
  onToggle: () => void;
  claimTexts: Map<string, string>;
  argTexts: Map<string, string>;
  userNames: Map<string, string>;
}) {
  const initiatingInfo = getMoveIcon(thread.initiatingMove.kind);
  const timestamp = new Date(thread.initiatingMove.createdAt);

  return (
    <div className="flex gap-4 group">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        {/* Dot */}
        <div
          className={`${initiatingInfo.color} w-3 h-3 rounded-full ring-4 ring-white shadow-md`}
        />
        {/* Vertical line */}
        <div className="w-0.5 flex-1 bg-gray-200 mt-1" style={{ minHeight: "60px" }} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <Card className="sidebarv2 border-l-4" style={{ borderLeftColor: initiatingInfo.color.replace("bg-", "#") }}>
          <CardContent className="p-3">
            {/* Thread header - always visible */}
            <div
              className="flex items-start justify-between cursor-pointer"
              onClick={onToggle}
            >
              <div className="flex items-center gap-2 flex-1">
                <div className={`${initiatingInfo.color} p-2 rounded-lg text-white`}>
                  {initiatingInfo.icon}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-base text-gray-900">
                    {initiatingInfo.label}
                   
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    <span>{userNames.get(thread.initiatingMove.actorId) || `User ${String(thread.initiatingMove.actorId).slice(0, 18)}...`}</span>
                    <span>•</span>
                    <Clock className="h-3 w-3" />
                    <span>{format(timestamp, "MMM d, yyyy 'at' h:mm a")}</span>
                     <button  className="cardv2 ml-4 rounded-full  text-slate-700 bg-white/30  text-xs px-3 py-1 ">
                      {thread.responses.length} {thread.responses.length === 1 ? "response" : "responses"}
                    </button>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <ArrowRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Target content - always visible */}
            {/* {thread.initiatingMove.targetId && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">
                  Target: {thread.initiatingMove.targetType}
                </div>
                {formatTargetText(thread.initiatingMove, claimTexts, argTexts)}
              </div>
            )} */}
          {thread.initiatingMove.targetId && (
              <div className="mt-3 py-3 px-4 text-xs surfacev2 bg-white rounded-lg shadow-md hover:translate-y-0 hover:shadow-md">
                <div className="text-[11px] mb-1 text-gray-700 bg-white/70 border border-indigo-300 px-1 w-fit rounded">
                  Target: {thread.initiatingMove.targetType}
                </div>
                {formatTargetText(thread.initiatingMove, claimTexts, argTexts)}
              </div>
            )}


            {/* Expanded responses */}
            {isExpanded && (
              <div className="mt-4 space-y-3 pl-4 border-l border-white">
                {thread.responses.map((response, idx) => {
                  const responseInfo = getMoveIcon(response.kind);
                  const responseTime = new Date(response.createdAt);
                  
                  return (
                    <div key={response.id} className="bg-white/50 surfacev2  rounded-lg border p-3">
                      <div className="flex items-start gap-2 ">
                        <div className={`${responseInfo.color} p-1.5 rounded-lg text-white`}>
                          {responseInfo.icon}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900">
                            {responseInfo.label}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <User className="h-3 w-3" />
                            <span>{userNames.get(response.actorId) || `User ${String(response.actorId).slice(0, 14)}...`}</span>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            <span>{format(responseTime, "MMM d, h:mm a")}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Response payload */}
                      {response.payload && Object.keys(response.payload).length > 0 && (
                        <div className="mt-3 text-xs text-gray-600">
                                          <pre className="mt-2 text-xs  px-4 py-4  rounded-lg drop-shadow-white overflow-x-auto">

                            {JSON.stringify(response.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Statistics Summary Component
 */
function TimelineStats({ moves }: { moves: DialogueMove[] }) {
  const stats = useMemo(() => {
    const kindCounts: Record<string, number> = {};
    const actorCounts: Record<string, number> = {};

    moves.forEach((move) => {
      kindCounts[move.kind] = (kindCounts[move.kind] || 0) + 1;
      const actorKey = String(move.actorId);
      actorCounts[actorKey] = (actorCounts[actorKey] || 0) + 1;
    });

    return {
      total: moves.length,
      byKind: kindCounts,
      byActor: actorCounts,
      uniqueActors: Object.keys(actorCounts).length,
      timespan:
        moves.length > 0
          ? {
              start: new Date(moves[0].createdAt),
              end: new Date(moves[moves.length - 1].createdAt),
            }
          : null,
    };
  }, [moves]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Total moves */}
      <Card className="surfacev2 panel-edge">
        <CardContent className="p-0">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total Moves</div>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card className="surfacev2 panel-edge">
        <CardContent className="p-0">
          <div className="text-2xl font-bold text-gray-900">{stats.uniqueActors}</div>
          <div className="text-sm text-gray-500">Participants</div>
        </CardContent>
      </Card>

      {/* Timespan */}
      <Card className="surfacev2 panel-edge">
        <CardContent className="p-0">
          <div className="text-2xl font-semibold text-gray-900">Duration</div>
          {stats.timespan ? (
            <div className="text-sm text-gray-500 ">
              {format(stats.timespan.start, "MMM d")} →{" "}
              {format(stats.timespan.end, "MMM d, yyyy")}
            </div>
          ) : (
            <div className="text-xm text-gray-500">No data</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Move Type Distribution Chart
 */
function MoveTypeDistribution({ moves }: { moves: DialogueMove[] }) {
  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    moves.forEach((move) => {
      counts[move.kind] = (counts[move.kind] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([kind, count]) => ({
        kind,
        count,
        percentage: (count / moves.length) * 100,
        ...getMoveIcon(kind),
      }))
      .sort((a, b) => b.count - a.count);
  }, [moves]);

  return (
        <Card className="panelv2 hover:translate-y-0 p-1">

      <CardHeader>
        <CardTitle className="text-lg">Move Type Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {distribution.map((item) => (
            <div key={item.kind} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`${item.color} p-1 rounded text-white`}>
                    {item.icon}
                  </div>
                  <span className="font-medium">{item.label}</span>
                </div>
                <span className="text-gray-600 text-xs">
                  {item.count} ({item.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`${item.color} h-2 rounded-full transition-all`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Activity Heatmap Component - Shows dialogue activity by day
 */
function ActivityHeatmap({ moves }: { moves: DialogueMove[] }) {
  const heatmapData = useMemo(() => {
    if (moves.length === 0) return { days: [], maxCount: 0, dateRange: null };

    // Group moves by date
    const countByDate: Record<string, number> = {};
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    moves.forEach((move) => {
      const date = new Date(move.createdAt);
      const dateKey = format(date, "yyyy-MM-dd");
      countByDate[dateKey] = (countByDate[dateKey] || 0) + 1;

      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    });

    if (!minDate || !maxDate) return { days: [], maxCount: 0, dateRange: null };

    // Generate all days in range
    const days: Array<{ date: string; count: number; displayDate: Date }> = [];
    const current = new Date(minDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(maxDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      const dateKey = format(current, "yyyy-MM-dd");
      days.push({
        date: dateKey,
        count: countByDate[dateKey] || 0,
        displayDate: new Date(current),
      });
      current.setDate(current.getDate() + 1);
    }

    const maxCount = Math.max(...Object.values(countByDate));

    return {
      days,
      maxCount,
      dateRange: { start: minDate, end: maxDate },
    };
  }, [moves]);

  const getIntensityColor = (count: number, maxCount: number) => {
    if (count === 0) return "bg-gray-100";
    const intensity = count / maxCount;
    if (intensity > 0.75) return "bg-indigo-600";
    if (intensity > 0.5) return "bg-indigo-500";
    if (intensity > 0.25) return "bg-indigo-400";
    return "bg-indigo-300";
  };

  if (heatmapData.days.length === 0) {
    return (
      <Card className="panelv2">
        <CardHeader>
          <CardTitle className="text-lg">Activity Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg text-gray-500">No activity data available</p>
        </CardContent>
      </Card>
    );
  }

  // Group days by week
  const weeks: Array<Array<typeof heatmapData.days[0]>> = [];
  let currentWeek: Array<typeof heatmapData.days[0]> = [];
  
  heatmapData.days.forEach((day, index) => {
    currentWeek.push(day);
    if (day.displayDate.getDay() === 6 || index === heatmapData.days.length - 1) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });

  return (
    <Card className="panelv2 hover:translate-y-0 p-1">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Activity Heatmap</span>
          {heatmapData.dateRange && (
            <span className="text-sm font-normal text-gray-500">
              {format(heatmapData.dateRange.start, "MMM d")} - {format(heatmapData.dateRange.end, "MMM d, yyyy")}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Day labels */}
          <div className="flex gap-1 text-xs text-gray-500 mb-2">
            <div className="w-8"></div>
            <div className="flex-1 grid grid-cols-7 gap-1 text-center">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>
          </div>

          {/* Heatmap grid */}
          <div className="space-y-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex gap-1 items-center">
                <div className="w-8 text-xs text-gray-500">
                  W{weekIndex + 1}
                </div>
                <div className="flex-1 grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const day = week.find((d) => d.displayDate.getDay() === dayIndex);
                    if (!day) {
                      return <div key={dayIndex} className="aspect-square rounded bg-gray-50" />;
                    }
                    return (
                      <div
                        key={day.date}
                        className={`aspect-square rounded ${getIntensityColor(day.count, heatmapData.maxCount)} hover:ring-2 hover:ring-indigo-400 transition-all cursor-pointer group relative`}
                        title={`${format(day.displayDate, "MMM d, yyyy")}: ${day.count} ${day.count === 1 ? "move" : "moves"}`}
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                          <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                            {format(day.displayDate, "MMM d")}: {day.count} {day.count === 1 ? "move" : "moves"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
            <span className="text-xs text-gray-500">Less</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 rounded bg-gray-100" />
              <div className="w-4 h-4 rounded bg-indigo-300" />
              <div className="w-4 h-4 rounded bg-indigo-400" />
              <div className="w-4 h-4 rounded bg-indigo-500" />
              <div className="w-4 h-4 rounded bg-indigo-600" />
            </div>
            <span className="text-xs text-gray-500">More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Main Dialogue Timeline Page
 */
export default function DialogueTimelinePage() {
  const params = useParams();
  const deliberationId = params?.id as string;

  const [filterKind, setFilterKind] = useState<string | null>(null);
  const [filterActor, setFilterActor] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"timeline" | "analytics">("timeline");

  // Helper function for date range presets
  const setDateRangePreset = (preset: "today" | "week" | "month") => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (preset) {
      case "today":
        setDateRange({
          start: today.toISOString().split("T")[0],
          end: today.toISOString().split("T")[0],
        });
        break;
      case "week":
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        setDateRange({
          start: weekAgo.toISOString().split("T")[0],
          end: today.toISOString().split("T")[0],
        });
        break;
      case "month":
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setDateRange({
          start: monthAgo.toISOString().split("T")[0],
          end: today.toISOString().split("T")[0],
        });
        break;
    }
  };

  // Fetch dialogue moves
  const { data: movesData, error: movesError, isLoading: movesLoading } = useSWR(
    `/api/dialogue/moves?deliberationId=${deliberationId}&limit=500&order=desc`,
    fetcher
  );

  // Fetch deliberation info
  const { data: delibData } = useSWR(
    `/api/deliberations/${deliberationId}`,
    fetcher
  );

  // Extract and fetch claim/argument texts for display
  const claimIds = useMemo(() => {
    if (!movesData?.items) return [];
    return Array.from(
      new Set(
        movesData.items
          .filter((m: DialogueMove) => m.targetType === "claim" && m.targetId)
          .map((m: DialogueMove) => m.targetId)
      )
    );
  }, [movesData]);

  const argIds = useMemo(() => {
    if (!movesData?.items) return [];
    return Array.from(
      new Set(
        movesData.items
          .filter((m: DialogueMove) => m.targetType === "argument" && m.targetId)
          .map((m: DialogueMove) => m.targetId)
      )
    );
  }, [movesData]);

  const { data: claimsData } = useSWR(
    claimIds.length > 0
      ? `/api/claims/batch?ids=${claimIds.join(",")}`
      : null,
    fetcher
  );

  const { data: argsData } = useSWR(
    argIds.length > 0
      ? `/api/arguments/batch?ids=${argIds.join(",")}`
      : null,
    fetcher
  );

  const claimTexts = useMemo(() => {
    const map = new Map<string, string>();
    if (claimsData?.claims) {
      claimsData.claims.forEach((c: any) => map.set(c.id, c.text));
    }
    return map;
  }, [claimsData]);

  const argTexts = useMemo(() => {
    const map = new Map<string, string>();
    if (argsData?.arguments) {
      argsData.arguments.forEach((a: any) => map.set(a.id, a.text));
    }
    return map;
  }, [argsData]);

  // Extract unique actor IDs and fetch user names
  const actorIds = useMemo(() => {
    if (!movesData?.items) return [];
    return Array.from(new Set(movesData.items.map((m: DialogueMove) => m.actorId)));
  }, [movesData]);

  const { data: usersData } = useSWR(
    actorIds.length > 0
      ? `/api/users/batch?ids=${actorIds.join(",")}`
      : null,
    fetcher
  );

  const userNames = useMemo(() => {
    const map = new Map<string, string>();
    if (usersData?.users) {
      usersData.users.forEach((u: any) => {
        const displayName = u.name || u.username || `User ${u.id.slice(0, 8)}`;
        map.set(u.id, displayName);
      });
    }
    return map;
  }, [usersData]);

  // Filter moves
  const filteredMoves = useMemo(() => {
    if (!movesData?.items) return [];
    let filtered = [...movesData.items];

    if (filterKind) {
      filtered = filtered.filter((m: DialogueMove) => m.kind === filterKind);
    }

    if (filterActor) {
      filtered = filtered.filter((m: DialogueMove) => String(m.actorId) === filterActor);
    }

    // Apply date range filter
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter((m: DialogueMove) => {
        const moveDate = new Date(m.createdAt);
        if (dateRange.start && moveDate < new Date(dateRange.start)) {
          return false;
        }
        if (dateRange.end) {
          const endDate = new Date(dateRange.end);
          endDate.setHours(23, 59, 59, 999); // Include the entire end date
          if (moveDate > endDate) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a: DialogueMove, b: DialogueMove) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  }, [movesData, filterKind, filterActor, dateRange, sortOrder]);

  // Get unique move kinds and actors for filters
  const uniqueKinds = useMemo<string[]>(() => {
    if (!movesData?.items) return [];
    return Array.from(new Set(movesData.items.map((m: DialogueMove) => String(m.kind))));
  }, [movesData]);

  const uniqueActors = useMemo<string[]>(() => {
    if (!movesData?.items) return [];
    return Array.from(new Set(movesData.items.map((m: DialogueMove) => String(m.actorId))));
  }, [movesData]);

  // Prepare moves and threads BEFORE conditional returns to avoid hook ordering issues
  const moves = filteredMoves as DialogueMove[];
  
  // Group moves into threads
  const threaded = useMemo(() => groupMovesIntoThreads(moves), [moves]);

  // Toggle thread expansion
  const toggleThread = (threadId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  if (movesLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading dialogue timeline...</p>
          </div>
        </div>
      </div>
    );
  }

  if (movesError) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <div>
                <div className="font-semibold">Failed to load dialogue timeline</div>
                <div className="text-sm text-red-500 mt-1">{movesError.message}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Export function
  const handleExport = () => {
    const exportData = moves.map((move) => ({
      timestamp: format(new Date(move.createdAt), "yyyy-MM-dd HH:mm:ss"),
      moveType: move.kind,
      actor: move.actorId,
      targetType: move.targetType,
      targetId: move.targetId,
      targetText: move.targetType === "claim" 
        ? claimTexts.get(move.targetId || "") || ""
        : move.targetType === "argument"
        ? argTexts.get(move.targetId || "") || ""
        : "",
      payload: JSON.stringify(move.payload),
    }));

    // Convert to CSV
    const headers = ["Timestamp", "Move Type", "Actor", "Target Type", "Target ID", "Target Text", "Payload"];
    const csvRows = [
      headers.join(","),
      ...exportData.map((row) =>
        [
          row.timestamp,
          row.moveType,
          row.actor,
          row.targetType,
          row.targetId,
          `"${row.targetText.replace(/"/g, '""')}"`, // Escape quotes
          `"${row.payload.replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dialogue-timeline-${deliberationId}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-semibold tracking0wide text-gray-900">Dialogue Timeline</h1>
          <div className="flex items-center gap-3">
            {/* Sort dropdown */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="menuv2--lite   text-sm  rounded-lg px-2 tracking-wide py-2 "
            >
              <option value="asc">Oldest First</option>
              <option value="desc">Latest First</option>
            </select>
            <button className="flex gap-2 items-center panelv2 text-sm rounded-lg px-3 py-2 bg-white/50" onClick={handleExport}>
              <Download className="h-4 w-4 " />
              Export
            </button>
          </div>
        </div>
        {delibData?.displayName && (
          <p className="text-gray-600">{delibData.displayName}</p>
        )}
      </div>

      {/* View mode tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="mb-6">
        <TabsList className="font-normal tracking-wide">
          <TabsTrigger value="timeline">Timeline View</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Timeline View */}
        <TabsContent value="timeline" className="mt-6">
          {/* Filters */}
          <Card className="mb-6 surfacev2  py-2 panel-edge hover:translate-y-0">
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* First row: Type and Participant filters */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Filters:</span>
                  </div>

                  {/* Move kind filter */}
                  <select
                    value={filterKind || ""}
                    onChange={(e) => setFilterKind(e.target.value || null)}
                    className="menuv2--lite text-sm  rounded-lg px-3 py-1.5"
                  >
                    <option value="">All Move Types</option>
                    {uniqueKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>

                  {/* Actor filter */}
                  <select
                    value={filterActor || ""}
                    onChange={(e) => setFilterActor(e.target.value || null)}
                    className="menuv2--lite text-sm  rounded-lg px-3 py-1.5"
                  >
                    <option value="">All Participants</option>
                    {uniqueActors.map((actor) => (
                      <option key={actor} value={actor}>
                        {userNames.get(actor) || `User ${actor.slice(0, 18)}...`}
                      </option>
                    ))}
                  </select>

                  {/* Clear filters */}
                  {(filterKind || filterActor || dateRange.start || dateRange.end) && (
                    <button
                        className="text-sm text-red-600 hover:underline"
                      onClick={() => {
                        setFilterKind(null);
                        setFilterActor(null);
                        setDateRange({ start: null, end: null });
                      }}
                    >
                      Clear All
                    </button>
                  )}

                  <div className="ml-auto text-xs text-gray-500">
                    Showing {moves.length} of {movesData?.items?.length || 0} moves
                  </div>
                </div>

                {/* Second row: Date range filter */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Date Range:</span>
                  </div>

                  <input
                    type="date"
                    value={dateRange.start || ""}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value || null }))}
                    className="text-sm menuv2--lite rounded-lg px-3 py-1 bg-white/50"
                    placeholder="Start date"
                  />
                  <span className="text-gray-800">→</span>
                  <input
                    type="date"
                    value={dateRange.end || ""}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value || null }))}
                    className="text-sm menuv2--lite rounded-lg px-3 py-1 bg-white/50"
                    placeholder="End date"
                  />

                  {/* Preset buttons */}
                  <div className="flex items-center gap-3">
                    <button
                      
                      onClick={() => setDateRangePreset("today")}
                      className="text-xs h-8 panelv2 rounded-lg px-3 py-1.5"
                    >
                      Today
                    </button>
                    <button
                  
                      onClick={() => setDateRangePreset("week")}
                      className="text-xs h-8 panelv2  rounded-lg px-3 py-1.5"
                    >
                      Last 7 Days
                    </button>
                    <button
                      onClick={() => setDateRangePreset("month")}
                      className="text-xs h-8 panelv2  rounded-lg px-3 py-1.5"
                    >
                      Last 30 Days
                    </button>
                   
                  </div>

                  {(dateRange.start || dateRange.end) && (
                    <button
                      className="h-8 w-8 p-0"
                      onClick={() => setDateRange({ start: null, end: null })}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          {moves.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No dialogue moves found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="pl-4">
              {threaded.map((item, index) => {
                // Check if it's a thread or a single move
                if ("initiatingMove" in item) {
                  const thread = item as DialogueThread;
                  return (
                    <ThreadCard
                      key={thread.id}
                      thread={thread}
                      isExpanded={expandedThreads.has(thread.id)}
                      onToggle={() => toggleThread(thread.id)}
                      claimTexts={claimTexts}
                      argTexts={argTexts}
                      userNames={userNames}
                    />
                  );
                } else {
                  const move = item as DialogueMove;
                  return (
                    <TimelineEventCard
                      key={move.id}
                      move={move}
                      isFirst={index === 0}
                      isLast={index === threaded.length - 1}
                      claimTexts={claimTexts}
                      argTexts={argTexts}
                      userNames={userNames}
                    />
                  );
                }
              })}
            </div>
          )}
        </TabsContent>

        {/* Analytics View */}
        <TabsContent value="analytics" className="mt-6">
          <div className="space-y-6">
            <TimelineStats moves={movesData?.items || []} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MoveTypeDistribution moves={movesData?.items || []} />
              <ActivityHeatmap moves={movesData?.items || []} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
