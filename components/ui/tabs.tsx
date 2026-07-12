"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: "default" | "dropdown";
  }
>(({ className, variant = "default", ...props }, ref) => {
  if (variant === "dropdown") {
    // Dropdown variant is handled by TabsListDropdown component
    return null;
  }
  
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex gap-0 cardv2 shadow-md hover:shadow-md bg-white/50 p-0 hover:translate-y-0 w-fit rounded-full overflow-hidden",
        className
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // default to no rounding, but make first/last get the end-caps
      "inline-flex w-full items-center justify-center whitespace-nowrap btnv2 rounded first:rounded-l-full last:rounded-r-full px-4 py-2 text-xs tracking-wide transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-slate-800 hover:data-[state=active]:bg-slate-800 hover:bg-white/50 data-[state=active]:text-slate-100  dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-slate-50",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

/**
 * Dropdown variant for TabsList - useful when there are many tabs
 * Uses Radix Select for the dropdown UI
 */
interface TabsListDropdownProps {
  children: React.ReactElement<typeof TabsTrigger>[] | React.ReactElement<typeof TabsTrigger>;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const TabsListDropdown = React.forwardRef<
  HTMLButtonElement,
  TabsListDropdownProps
>(({ children, value, onValueChange, placeholder = "Select...", className }, ref) => {
  const childrenArray = React.Children.toArray(children) as React.ReactElement[];
  
  // Extract tab options from children
  const options = childrenArray.map((child) => ({
    value: child.props.value,
    label: child.props.children,
  }));

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        ref={ref}
        className={cn(
          "flex h-fit w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-950 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300",
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder}>
          {selectedOption?.label || placeholder}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal >
        <SelectPrimitive.Content
          className="relative z-50 max-h-[500px] w-full flex overflow-y-auto rounded-lg border border-slate-800 bg-white/30 backdrop-blur text-slate-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
         
          
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex w-full  cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-slate-300 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:focus:bg-slate-800 dark:focus:text-slate-50"
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator >
                    <Check className="h-4 w-4" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
});
TabsListDropdown.displayName = "TabsListDropdown";

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsListDropdown };
