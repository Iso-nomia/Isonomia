"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

interface EdgeFilterPanelProps {
  filters: {
    showPrerequisite: boolean;
    showSupporting: boolean;
    showEnabling: boolean;
    showBackground: boolean;
    minStrength: number;
    showOnlyCriticalPath: boolean;
  };
  onFilterChange: (filters: any) => void;
}

export function EdgeFilterPanel({ filters, onFilterChange }: EdgeFilterPanelProps) {
  const handleToggle = (key: string, value: boolean) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handleStrengthChange = (value: number[]) => {
    onFilterChange({ ...filters, minStrength: value[0] / 100 });
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-3">
        <h4 className="font-semibold text-sm">Dependency Types</h4>

        <div className="flex items-center justify-between">
          <Label htmlFor="prerequisite" className="text-xs">
            Prerequisite
          </Label>
          <Switch
            id="prerequisite"
            checked={filters.showPrerequisite}
            onCheckedChange={(checked) => handleToggle("showPrerequisite", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="supporting" className="text-xs">
            Supporting
          </Label>
          <Switch
            id="supporting"
            checked={filters.showSupporting}
            onCheckedChange={(checked) => handleToggle("showSupporting", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="enabling" className="text-xs">
            Enabling
          </Label>
          <Switch
            id="enabling"
            checked={filters.showEnabling}
            onCheckedChange={(checked) => handleToggle("showEnabling", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="background" className="text-xs">
            Background
          </Label>
          <Switch
            id="background"
            checked={filters.showBackground}
            onCheckedChange={(checked) => handleToggle("showBackground", checked)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">
          Minimum Strength: {Math.round(filters.minStrength * 100)}%
        </Label>
        <Slider
          value={[filters.minStrength * 100]}
          onValueChange={handleStrengthChange}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="criticalPath" className="text-xs">
          Critical Path Only
        </Label>
        <Switch
          id="criticalPath"
          checked={filters.showOnlyCriticalPath}
          onCheckedChange={(checked) => handleToggle("showOnlyCriticalPath", checked)}
        />
      </div>
    </Card>
  );
}
