"use client";

import React, { useEffect, useState } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export interface NestedTab {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
  content: React.ReactNode;
}

export interface NestedTabsProps {
  id: string; // For localStorage persistence
  defaultValue: string;
  tabs: NestedTab[];
  className?: string;
  variant?: "primary" | "secondary";
  onChange?: (value: string) => void;
}

/**
 * NestedTabs component for hierarchical tab structures
 * 
 * Features:
 * - Primary variant: Main navigation tabs (full styling)
 * - Secondary variant: Nested tabs (subtle, indented)
 * - localStorage persistence of active tab
 * - Keyboard navigation support
 * - Badge support for counts/notifications
 * - Icon support
 * 
 * Usage:
 * ```tsx
 * <NestedTabs
 *   id="arguments-subtabs"
 *   defaultValue="list"
 *   tabs={[
 *     { value: 'list', label: 'List', content: <ArgumentsList /> },
 *     { value: 'schemes', label: 'Schemes', badge: 3, content: <Schemes /> }
 *   ]}
 *   variant="secondary"
 * />
 * ```
 */
export function NestedTabs({
  id,
  defaultValue,
  tabs,
  className = "",
  variant = "primary",
  onChange,
}: NestedTabsProps) {
  // Load persisted tab from localStorage
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return defaultValue;
    
    try {
      const stored = window.localStorage.getItem(`nestedTabs:${id}`);
      if (stored && tabs.some(t => t.value === stored)) {
        return stored;
      }
    } catch {
      // localStorage unavailable
    }
    
    return defaultValue;
  });

  // Persist tab selection to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(`nestedTabs:${id}`, activeTab);
    } catch {
      // localStorage unavailable
    }
  }, [id, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    onChange?.(value);
  };

  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";

  return (
    <TabsPrimitive.Root
      value={activeTab}
      onValueChange={handleTabChange}
      className={cn("w-full", className)}
    >
      <TabsPrimitive.List
        className={cn(
          "inline-flex gap-0 w-fit overflow-hidden",
          isPrimary && [
            "cardv2 shadow-md hover:shadow-md bg-white/50 p-0 rounded-full",
            "hover:translate-y-0"
          ],
          isSecondary && [
            "ml-4 border-b border-slate-200 dark:border-slate-800",
            "bg-slate-50/50 dark:bg-slate-900/30 rounded-t-lg"
          ]
        )}
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "inline-flex items-center justify-center gap-2 whitespace-nowrap",
              "transition-all focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-50",
              
              // Primary variant (parent tabs)
              isPrimary && [
                "btnv2 rounded first:rounded-l-full last:rounded-r-full",
                "px-4 py-2 text-xs tracking-wide",
                "data-[state=active]:bg-slate-800 hover:data-[state=active]:bg-slate-800",
                "hover:bg-white/50 data-[state=active]:text-slate-100",
                "dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-slate-50"
              ],
              
              // Secondary variant (nested tabs)
              isSecondary && [
                "relative px-3 py-2 text-xs font-medium",
                "text-slate-600 hover:text-slate-900",
                "dark:text-slate-400 dark:hover:text-slate-100",
                "data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-400",
                // Underline indicator for active tab
                "data-[state=active]:after:absolute data-[state=active]:after:bottom-0",
                "data-[state=active]:after:left-0 data-[state=active]:after:right-0",
                "data-[state=active]:after:h-0.5 data-[state=active]:after:bg-indigo-600",
                "dark:data-[state=active]:after:bg-indigo-400"
              ]
            )}
          >
            {tab.icon && (
              <span className={cn(
                "shrink-0",
                isPrimary && "size-4",
                isSecondary && "size-3.5"
              )}>
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "flex items-center justify-center rounded-full font-semibold",
                  isPrimary && "size-5 text-[10px] bg-indigo-500 text-white",
                  isSecondary && "size-4 text-[9px] bg-indigo-100 text-indigo-700",
                  "dark:bg-indigo-900/50 dark:text-indigo-300"
                )}
              >
                {tab.badge}
              </span>
            )}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {tabs.map((tab) => (
        <TabsPrimitive.Content
          key={tab.value}
          value={tab.value}
          className={cn(
            "mt-3 ring-offset-white focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2",
            "dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300"
          )}
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
