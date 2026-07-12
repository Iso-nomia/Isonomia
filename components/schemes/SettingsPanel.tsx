/**
 * Settings Panel
 * 
 * User preferences and customization options for the navigator.
 * 
 * Week 8, Task 8.3: User Preferences
 */

"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, X, Download, Upload } from "lucide-react";
import { useNavigationStore, type NavigationMode } from "@/lib/schemes/navigation-state";
import { getModeLabel } from "@/lib/schemes/navigation-integration";

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const {
    currentMode,
    setMode,
    favoriteSchemeKeys,
    recentSchemes,
    conditionsState,
    setConditionsSortBy,
    setShowTutorial,
    clusterState,
    setClusterViewMode,
  } = useNavigationStore();

  const handleExportData = () => {
    const data = {
      favorites: favoriteSchemeKeys,
      recents: recentSchemes,
      preferences: {
        defaultMode: currentMode,
        conditionsSortBy: conditionsState.sortBy,
        clusterViewMode: clusterState.viewMode,
      },
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scheme-navigator-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            // Import logic would go here
            alert("Import successful! (Feature coming soon)");
          } catch (error) {
            alert("Failed to import data. Please check the file format.");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <Card className="p-6  panel-edge modalv2">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          <h3 className="text-lg font-bold">Settings & Preferences</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-6">
        {/* Default Mode */}
        <div className="space-y-2">
          <Label htmlFor="default-mode">Default Navigation Mode</Label>
          <Select value={currentMode} onValueChange={(v) => setMode(v as NavigationMode)}>
            <SelectTrigger id="default-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tree">{getModeLabel("tree")} (Wizard)</SelectItem>
              <SelectItem value="cluster">{getModeLabel("cluster")}</SelectItem>
              <SelectItem value="conditions">{getModeLabel("conditions")}</SelectItem>
              <SelectItem value="search">{getModeLabel("search")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500-foreground">
            The navigator will open in this mode by default
          </p>
        </div>

        {/* Conditions Preferences */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Identification Conditions</h4>
          
          <div className="space-y-2">
            <Label htmlFor="conditions-sort">Default Sort Order</Label>
            <Select
              value={conditionsState.sortBy}
              onValueChange={(v) => setConditionsSortBy(v as "score" | "name")}
            >
              <SelectTrigger id="conditions-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">By Match Score</SelectItem>
                <SelectItem value="name">Alphabetically</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="show-tutorial">Show Tutorial on First Visit</Label>
            <Switch
              id="show-tutorial"
              checked={conditionsState.showTutorial}
              onCheckedChange={setShowTutorial}
            />
          </div>
        </div>

        {/* Cluster Preferences */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Cluster Browser</h4>
          
          <div className="space-y-2">
            <Label htmlFor="cluster-view">Default View Mode</Label>
            <Select
              value={clusterState.viewMode}
              onValueChange={(v) => setClusterViewMode(v as "grid" | "list")}
            >
              <SelectTrigger id="cluster-view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid View</SelectItem>
                <SelectItem value="list">List View</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data Management */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-semibold text-sm">Data Management</h4>
          
          <div className="flex items-center justify-between p-3 bg-white rounded">
            <div>
              <p className="text-sm font-medium">Favorites</p>
              <p className="text-xs text-slate-500">
                {favoriteSchemeKeys.length} schemes saved
              </p>
            </div>
            <Badge variant="secondary">{favoriteSchemeKeys.length}</Badge>
          </div>

          <div className="flex items-center justify-between p-3 bg-white rounded">
            <div>
              <p className="text-sm font-medium">Recent History</p>
              <p className="text-xs text-slate-500">
                {recentSchemes.length} schemes in history
              </p>
            </div>
            <Badge variant="secondary">{recentSchemes.length}</Badge>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportData}
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Data
            </Button>
          </div>
        </div>

        {/* About */}
        <div className="pt-4 border-t text-center text-xs text-slate-500">
          <p>Scheme Navigator v1.0</p>
          <p className="mt-1">
            Week 8: Unified Multi-Entry Navigation
          </p>
        </div>
      </div>
    </Card>
  );
}
