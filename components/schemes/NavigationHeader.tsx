/**
 * Navigation Header Component
 * 
 * Header bar with navigation utilities, recents, favorites, and help.
 * Provides quick access to common actions across all modes.
 * 
 * Week 8, Task 8.3: User Preferences
 */

"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Star,
  HelpCircle,
  RotateCcw,
  Settings,
} from "lucide-react";
import { useNavigationStore } from "@/lib/schemes/navigation-state";
import { getModeHelpText } from "@/lib/schemes/navigation-integration";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavigationHeaderProps {
  onShowRecents: () => void;
  onShowFavorites: () => void;
  onShowSettings: () => void;
  recentCount: number;
  favoriteCount: number;
}

/**
 * Header with navigation utilities and quick actions
 */
export default function NavigationHeader({
  onShowRecents,
  onShowFavorites,
  onShowSettings,
  recentCount,
  favoriteCount,
}: NavigationHeaderProps) {
  const { currentMode, resetAll } = useNavigationStore();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    if (showResetConfirm) {
      resetAll();
      setShowResetConfirm(false);
    } else {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 3000);
    }
  };

  const helpText = getModeHelpText(currentMode);

  return (
    <div className="flex items-center rounded-b-xl mb-2 border border-indigo-400 bg-indigo-100/50 
    backdrop-blur-xl justify-between gap-4 px-3 py-2 sticky top-0 z-10">
      {/* Left: Help Text */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground truncate">{helpText}</p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <TooltipProvider>
          {/* Recents */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onShowRecents}
                className="relative"
              >
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Recents</span>
                {recentCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {recentCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-200 p-2 rouded">
              <p>Recently viewed schemes ({recentCount})</p>
            </TooltipContent>
          </Tooltip>

          {/* Favorites */}
          <Tooltip >
            <TooltipTrigger asChild >
              <Button
                variant="ghost"
                onClick={onShowFavorites}
                className="relative "
              >
                <Star className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Favorites</span>
                {favoriteCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {favoriteCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-200 p-2 rounded">
              <p>Your favorite schemes ({favoriteCount})</p>
            </TooltipContent>
          </Tooltip>

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onShowSettings}>
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Settings</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-200 p-2 rounded">
              <p>Preferences and settings</p>
            </TooltipContent>
          </Tooltip>

          {/* Reset */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showResetConfirm ? "destructive" : "ghost"}
                size="sm"
                onClick={handleReset}
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">
                  {showResetConfirm ? "Confirm?" : "Reset"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-200 p-2 rounded">
              <p>
                {showResetConfirm
                  ? "Click again to confirm reset"
                  : "Reset all navigation state"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
