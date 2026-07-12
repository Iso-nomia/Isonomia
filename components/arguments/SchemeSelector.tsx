// components/arguments/SchemeSelector.tsx
"use client";

import { useState, useMemo } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Search, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArgumentationScheme {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  category?: string | null;
  summary?: string;
  cq?: any; // JSON field
}

interface SchemeSelectorProps {
  schemes: ArgumentationScheme[];
  selectedSchemeIds: string[];
  onSchemeToggle: (schemeId: string) => void;
  multiSelect?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

/**
 * SchemeSelector - Searchable dropdown for selecting argumentation schemes
 * 
 * Features:
 * - Grouped by category
 * - Search by name or description
 * - Shows CQ count for each scheme
 * - Single or multi-select mode
 * - Keyboard navigation
 */
export function SchemeSelector({
  schemes,
  selectedSchemeIds,
  onSchemeToggle,
  multiSelect = false,
  disabled = false,
  className,
  placeholder
}: SchemeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  // Group schemes by category
  const groupedSchemes = useMemo(() => {
    const groups: Record<string, ArgumentationScheme[]> = {};
    
    schemes.forEach(scheme => {
      const category = scheme.category || "Other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(scheme);
    });
    
    // Sort schemes within each category alphabetically
    Object.keys(groups).forEach(category => {
      groups[category].sort((a, b) => a.name.localeCompare(b.name));
    });
    
    return groups;
  }, [schemes]);
  
  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!search) return groupedSchemes;
    
    const filtered: Record<string, ArgumentationScheme[]> = {};
    const searchLower = search.toLowerCase();
    
    Object.entries(groupedSchemes).forEach(([category, categorySchemes]) => {
      const matching = categorySchemes.filter(
        s => s.name.toLowerCase().includes(searchLower) ||
             s.key.toLowerCase().includes(searchLower) ||
             s.description?.toLowerCase().includes(searchLower) ||
             s.summary?.toLowerCase().includes(searchLower)
      );
      
      if (matching.length > 0) {
        filtered[category] = matching;
      }
    });
    
    return filtered;
  }, [groupedSchemes, search]);
  
  const selectedCount = selectedSchemeIds.length;
  const selectedSchemes = schemes.filter(s => selectedSchemeIds.includes(s.id));
  
  // Get CQ count from scheme cq field (JSON)
  const getCQCount = (scheme: ArgumentationScheme): number => {
    if (!scheme.cq) return 0;
    if (typeof scheme.cq === "object" && Array.isArray(scheme.cq)) {
      return scheme.cq.length;
    }
    return 0;
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span className="flex items-center gap-2 truncate">
            {selectedCount === 0 ? (
              <>
                <Search className="w-4 h-4 opacity-50 shrink-0" />
                <span className="truncate">
                  {placeholder || `Select scheme${multiSelect ? "s" : ""}...`}
                </span>
              </>
            ) : multiSelect ? (
              <>
                <Check className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {selectedCount} scheme{selectedCount !== 1 ? "s" : ""} selected
                </span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {selectedSchemes[0]?.name || "Unknown"}
                </span>
              </>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px] p-0">
        <Command>
          <CommandInput 
            placeholder="Search schemes..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <HelpCircle className="w-8 h-8 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No schemes found.</p>
                {search && (
                  <p className="text-xs text-muted-foreground">
                    Try a different search term
                  </p>
                )}
              </div>
            </CommandEmpty>
            
            {Object.entries(filteredGroups)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, categorySchemes]) => (
              <CommandGroup key={category} heading={category}>
                {categorySchemes.map(scheme => {
                  const isSelected = selectedSchemeIds.includes(scheme.id);
                  const cqCount = getCQCount(scheme);
                  
                  return (
                    <CommandItem
                      key={scheme.id}
                      value={scheme.id}
                      onSelect={() => {
                        onSchemeToggle(scheme.id);
                        if (!multiSelect) {
                          setOpen(false);
                        }
                      }}
                      className="flex items-start gap-2 py-3 cursor-pointer"
                    >
                      <div className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
                        isSelected 
                          ? "bg-primary text-primary-foreground" 
                          : "opacity-50"
                      )}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium leading-none truncate">
                            {scheme.name}
                          </p>
                          {cqCount > 0 && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {cqCount} CQ{cqCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        {(scheme.description || scheme.summary) && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {scheme.description || scheme.summary}
                          </p>
                        )}
                        {scheme.key && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {scheme.key}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        
        {multiSelect && selectedCount > 0 && (
          <div className="border-t p-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{selectedCount} selected</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  selectedSchemeIds.forEach(id => onSchemeToggle(id));
                }}
                className="h-6 text-xs"
              >
                Clear all
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
