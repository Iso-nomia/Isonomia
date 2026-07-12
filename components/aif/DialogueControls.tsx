// components/aif/DialogueControls.tsx
"use client";
import { useState } from "react";
import { Eye, EyeOff, Filter, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

/**
 * DialogueControls Component
 * 
 * Control panel for toggling dialogue visualization features in AIF graphs.
 * Provides filters for move types, participants, and time ranges.
 * 
 * Features:
 * - Toggle dialogue layer visibility (show/hide DM-nodes and edges)
 * - Filter by move type (protocol moves only, structural moves, all)
 * - Filter by participant (show moves from specific speakers)
 * - Filter by time range (show moves within date range)
 * 
 * Design Philosophy:
 * - Non-invasive: Dialogue layer is opt-in, existing views unchanged
 * - Progressive disclosure: Simple toggle expands to detailed filters
 * - Visual feedback: Active filters shown as badges
 * - Accessible: Keyboard navigation and ARIA labels
 */

export type DialogueMoveFilter = "all" | "protocol" | "structural";

export interface DialogueControlState {
  /** Show/hide dialogue layer */
  showDialogue: boolean;
  
  /** Filter by move type */
  moveFilter: DialogueMoveFilter;
  
  /** Filter by participant ID (null = show all) */
  participantFilter: string | null;
  
  /** Filter by time range (null = show all) */
  timeRange: { start: Date; end: Date } | null;
}

interface DialogueControlsProps {
  /** Current control state */
  state: DialogueControlState;
  
  /** Callback when state changes */
  onChange: (state: DialogueControlState) => void;
  
  /** Available participants for filtering */
  participants?: Array<{ id: string; name: string }>;
  
  /** Show advanced filters (participant, time range) */
  showAdvancedFilters?: boolean;
  
  /** Additional CSS classes */
  className?: string;
}

const MOVE_FILTER_LABELS: Record<DialogueMoveFilter, string> = {
  all: "All Moves",
  protocol: "Protocol Only",
  structural: "Structural Only"
};

const MOVE_FILTER_DESCRIPTIONS: Record<DialogueMoveFilter, string> = {
  all: "Show all dialogue moves (WHY, GROUNDS, ASSERT, ATTACK, etc.)",
  protocol: "Show protocol moves only (WHY, CONCEDE, RETRACT, CLOSE)",
  structural: "Show structural moves only (GROUNDS, ATTACK, ASSERT)"
};

export function DialogueControls({
  state,
  onChange,
  participants = [],
  showAdvancedFilters = true,
  className = ""
}: DialogueControlsProps) {
  const [localState, setLocalState] = useState(state);

  // Update local state and notify parent
  const updateState = (updates: Partial<DialogueControlState>) => {
    const newState = { ...localState, ...updates };
    setLocalState(newState);
    onChange(newState);
  };

  // Toggle dialogue visibility
  const toggleDialogue = () => {
    updateState({ showDialogue: !localState.showDialogue });
  };

  // Count active filters
  const activeFilterCount = [
    localState.moveFilter !== "all",
    localState.participantFilter !== null,
    localState.timeRange !== null
  ].filter(Boolean).length;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Primary toggle: Show/hide dialogue layer */}
      <button
        onClick={toggleDialogue}
        className="flex gap-2 px-3 py-2 btnv2 rounded-xl"
        aria-label={localState.showDialogue ? "Hide dialogue layer" : "Show dialogue layer"}
      >
        {localState.showDialogue ? (
          <>
            <Eye className="h-4 w-4" />
            Dialogue ON
          </>
        ) : (
          <>
            <EyeOff className="h-4 w-4" />
            Dialogue OFF
          </>
        )}
      </button>

      {/* Filter controls (only shown when dialogue layer is visible) */}
      {localState.showDialogue && (
        <>
          {/* Move type filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                       className="flex gap-2 px-3 py-2 btnv2 rounded-xl"

                aria-label="Filter dialogue moves"
              >
                <Filter className="h-4 w-4" />
                {MOVE_FILTER_LABELS[localState.moveFilter]}
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                    {activeFilterCount}
                  </Badge>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Move Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {(["all", "protocol", "structural"] as const).map((filter) => (
                <DropdownMenuCheckboxItem
                  key={filter}
                  checked={localState.moveFilter === filter}
                  onCheckedChange={() => updateState({ moveFilter: filter })}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{MOVE_FILTER_LABELS[filter]}</span>
                    <span className="text-xs text-gray-500">
                      {MOVE_FILTER_DESCRIPTIONS[filter]}
                    </span>
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Advanced filters */}
          {showAdvancedFilters && (
            <>
              {/* Participant filter */}
              {participants.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={localState.participantFilter ? "default" : "outline"}
                      size="sm"
                      className="gap-2"
                      aria-label="Filter by participant"
                    >
                      <User className="h-4 w-4" />
                      {localState.participantFilter
                        ? participants.find(p => p.id === localState.participantFilter)?.name || "Unknown"
                        : "All Participants"
                      }
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>Filter by Participant</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuCheckboxItem
                      checked={localState.participantFilter === null}
                      onCheckedChange={() => updateState({ participantFilter: null })}
                    >
                      All Participants
                    </DropdownMenuCheckboxItem>
                    
                    <DropdownMenuSeparator />
                    
                    {participants.map((participant) => (
                      <DropdownMenuCheckboxItem
                        key={participant.id}
                        checked={localState.participantFilter === participant.id}
                        onCheckedChange={(checked) => 
                          updateState({ participantFilter: checked ? participant.id : null })
                        }
                      >
                        {participant.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Time range filter (placeholder for future enhancement) */}
              {localState.timeRange && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => updateState({ timeRange: null })}
                  aria-label="Clear time range filter"
                >
                  <Clock className="h-4 w-4" />
                  Custom Range
                  <span className="text-xs ml-1">×</span>
                </Button>
              )}
            </>
          )}
        </>
      )}

      {/* Active filter summary */}
      {localState.showDialogue && activeFilterCount > 0 && (
        <div className="text-xs text-gray-500 ml-2">
          {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
        </div>
      )}
    </div>
  );
}

/**
 * TimeRangeSlider Component
 * 
 * Visual slider for selecting time range of dialogue moves to display.
 * Useful for "replaying" dialogue evolution over time.
 */
interface TimeRangeSliderProps {
  /** Start timestamp of deliberation */
  minTime: Date;
  
  /** End timestamp of deliberation */
  maxTime: Date;
  
  /** Current selected range */
  value: [Date, Date];
  
  /** Callback when range changes */
  onChange: (range: [Date, Date]) => void;
  
  /** Additional CSS classes */
  className?: string;
}

export function TimeRangeSlider({
  minTime,
  maxTime,
  value,
  onChange,
  className = ""
}: TimeRangeSliderProps) {
  const totalMs = maxTime.getTime() - minTime.getTime();
  const startPercent = ((value[0].getTime() - minTime.getTime()) / totalMs) * 100;
  const endPercent = ((value[1].getTime() - minTime.getTime()) / totalMs) * 100;

  const handleChange = (values: number[]) => {
    const [start, end] = values;
    const startMs = minTime.getTime() + (start / 100) * totalMs;
    const endMs = minTime.getTime() + (end / 100) * totalMs;
    onChange([new Date(startMs), new Date(endMs)]);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-xs font-medium">Time Range</Label>
      <Slider
        value={[startPercent, endPercent]}
        onValueChange={handleChange}
        min={0}
        max={100}
        step={1}
        className="w-full"
        aria-label="Select time range for dialogue moves"
      />
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>{value[0].toLocaleDateString()}</span>
        <span>{value[1].toLocaleDateString()}</span>
      </div>
    </div>
  );
}
