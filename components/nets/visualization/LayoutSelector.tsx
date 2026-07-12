"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutGrid } from "lucide-react";

interface LayoutSelectorProps {
  currentLayout: "hierarchical" | "force" | "circular" | "tree";
  onLayoutChange: (layout: "hierarchical" | "force" | "circular" | "tree") => void;
}

export function LayoutSelector({ currentLayout, onLayoutChange }: LayoutSelectorProps) {
  const layouts = [
    { value: "hierarchical" as const, label: "Hierarchical" },
    { value: "force" as const, label: "Force-Directed" },
    { value: "circular" as const, label: "Circular" },
    { value: "tree" as const, label: "Tree" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <LayoutGrid className="w-4 h-4 mr-2" />
          {layouts.find((l) => l.value === currentLayout)?.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {layouts.map((layout) => (
          <DropdownMenuItem
            key={layout.value}
            onClick={() => onLayoutChange(layout.value)}
            className={currentLayout === layout.value ? "bg-gray-100" : ""}
          >
            {layout.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
