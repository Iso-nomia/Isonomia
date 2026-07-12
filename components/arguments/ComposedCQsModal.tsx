// components/arguments/ComposedCQsModal.tsx
"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MultiSchemeBadge } from "./MultiSchemeBadge";
import { composeCriticalQuestions, filterComposedCQs, getCQStatsSummary } from "@/lib/utils/compose-critical-questions";
import { 
  Filter, 
  Layers, 
  Target, 
  AlertCircle, 
  Loader2, 
  HelpCircle,
  ChevronDown,
  Shield
} from "lucide-react";
import type { ArgumentWithSchemes } from "@/lib/types/argument-net";
import type { ComposedCriticalQuestion } from "@/lib/types/composed-cqs";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ComposedCQsModalProps {
  argumentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ComposedCQsModal - Display critical questions from all schemes in a multi-scheme argument
 * 
 * Features:
 * - Tabs: By Scheme / By Attack Type / By Target
 * - Filters: Scheme, attack type, source role
 * - Visual grouping with MultiSchemeBadge
 * - Statistics and counts
 */
export function ComposedCQsModal({
  argumentId,
  open,
  onOpenChange
}: ComposedCQsModalProps) {
  const [selectedTab, setSelectedTab] = useState<"byScheme" | "byAttack" | "byTarget">("byScheme");
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter state
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<string[]>([]);
  const [selectedAttackTypes, setSelectedAttackTypes] = useState<string[]>([]);
  const [selectedSourceRoles, setSelectedSourceRoles] = useState<string[]>([]);
  
  // Fetch argument with schemes
  const { data: argument, error, isLoading } = useSWR<ArgumentWithSchemes>(
    open ? `/api/arguments/${argumentId}` : null,
    fetcher
  );
  
  // Compose CQs from all schemes
  const composedSet = useMemo(() => {
    if (!argument) return null;
    return composeCriticalQuestions(argument);
  }, [argument]);
  
  // Apply filters
  const filteredCQs = useMemo(() => {
    if (!composedSet) return [];
    
    if (
      selectedSchemeIds.length === 0 &&
      selectedAttackTypes.length === 0 &&
      selectedSourceRoles.length === 0
    ) {
      return composedSet.byScheme.flatMap(g => g.cqs);
    }
    
    return filterComposedCQs(composedSet, {
      schemeInstanceIds: selectedSchemeIds.length > 0 ? selectedSchemeIds : undefined,
      attackTypes: selectedAttackTypes.length > 0 ? selectedAttackTypes : undefined,
      sourceRoles: selectedSourceRoles.length > 0 
        ? selectedSourceRoles as any 
        : undefined
    });
  }, [composedSet, selectedSchemeIds, selectedAttackTypes, selectedSourceRoles]);
  
  const toggleSchemeFilter = (schemeId: string) => {
    setSelectedSchemeIds(prev =>
      prev.includes(schemeId)
        ? prev.filter(id => id !== schemeId)
        : [...prev, schemeId]
    );
  };
  
  const toggleAttackTypeFilter = (attackType: string) => {
    setSelectedAttackTypes(prev =>
      prev.includes(attackType)
        ? prev.filter(t => t !== attackType)
        : [...prev, attackType]
    );
  };
  
  const toggleSourceRoleFilter = (role: string) => {
    setSelectedSourceRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };
  
  const clearFilters = () => {
    setSelectedSchemeIds([]);
    setSelectedAttackTypes([]);
    setSelectedSourceRoles([]);
  };
  
  const hasActiveFilters = 
    selectedSchemeIds.length > 0 ||
    selectedAttackTypes.length > 0 ||
    selectedSourceRoles.length > 0;
  
  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  if (error || !argument || !composedSet) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="p-4 text-sm text-red-600 bg-red-50 rounded-md">
            Failed to load critical questions
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  const statsSummary = getCQStatsSummary(composedSet);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            Critical Questions
            <Badge variant="secondary" className="ml-2">
              {composedSet.totalCQs}
            </Badge>
          </DialogTitle>
          <DialogDescription className="space-y-1">
            {statsSummary.map((stat, i) => (
              <div key={i} className="text-sm text-muted-foreground">
                {stat}
              </div>
            ))}
          </DialogDescription>
        </DialogHeader>
        
        {/* Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="default" className="ml-1">
                  {selectedSchemeIds.length + selectedAttackTypes.length + selectedSourceRoles.length}
                </Badge>
              )}
            </Button>
            
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </div>
          
          {showFilters && (
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-3 gap-4">
                  {/* Scheme filter */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      BY SCHEME
                    </Label>
                    {composedSet.byScheme.map(group => (
                      <div key={group.schemeInstanceId} className="flex items-center space-x-2">
                        <Checkbox
                          id={`scheme-${group.schemeInstanceId}`}
                          checked={selectedSchemeIds.includes(group.schemeInstanceId)}
                          onCheckedChange={() => toggleSchemeFilter(group.schemeInstanceId)}
                        />
                        <label
                          htmlFor={`scheme-${group.schemeInstanceId}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {group.schemeName}
                          <Badge variant="outline" className="ml-2">
                            {group.cqs.length}
                          </Badge>
                        </label>
                      </div>
                    ))}
                  </div>
                  
                  {/* Attack type filter */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      BY ATTACK TYPE
                    </Label>
                    {composedSet.byAttackType.map(group => (
                      <div key={group.attackType} className="flex items-center space-x-2">
                        <Checkbox
                          id={`attack-${group.attackType}`}
                          checked={selectedAttackTypes.includes(group.attackType)}
                          onCheckedChange={() => toggleAttackTypeFilter(group.attackType)}
                        />
                        <label
                          htmlFor={`attack-${group.attackType}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {group.displayName}
                          <Badge variant="outline" className="ml-2">
                            {group.cqs.length}
                          </Badge>
                        </label>
                      </div>
                    ))}
                  </div>
                  
                  {/* Source role filter */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      BY SOURCE ROLE
                    </Label>
                    {[
                      { role: "primary", label: "Primary", count: composedSet.stats.fromPrimary },
                      { role: "supporting", label: "Supporting", count: composedSet.stats.fromSupporting },
                      { role: "presupposed", label: "Presupposed", count: composedSet.stats.fromPresupposed },
                      { role: "implicit", label: "Implicit", count: composedSet.stats.fromImplicit },
                    ].filter(r => r.count > 0).map(({ role, label, count }) => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role}`}
                          checked={selectedSourceRoles.includes(role)}
                          onCheckedChange={() => toggleSourceRoleFilter(role)}
                        />
                        <label
                          htmlFor={`role-${role}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {label}
                          <Badge variant="outline" className="ml-2">
                            {count}
                          </Badge>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Filtered count */}
        {hasActiveFilters && (
          <div className="text-sm text-muted-foreground">
            Showing {filteredCQs.length} of {composedSet.totalCQs} questions
          </div>
        )}
        
        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="byScheme" className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              By Scheme
            </TabsTrigger>
            <TabsTrigger value="byAttack" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              By Attack Type
            </TabsTrigger>
            <TabsTrigger value="byTarget" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              By Target
            </TabsTrigger>
          </TabsList>
          
          {/* By Scheme Tab */}
          <TabsContent value="byScheme" className="mt-4 space-y-3">
            {composedSet.byScheme
              .filter(group => 
                !hasActiveFilters || 
                filteredCQs.some(cq => cq.sourceSchemeInstance.id === group.schemeInstanceId)
              )
              .map(group => {
                const groupCQs = hasActiveFilters
                  ? filteredCQs.filter(cq => cq.sourceSchemeInstance.id === group.schemeInstanceId)
                  : group.cqs;
                
                if (groupCQs.length === 0) return null;
                
                return (
                  <Card key={group.schemeInstanceId}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MultiSchemeBadge
                            schemeInstance={groupCQs[0].sourceSchemeInstance}
                            size="sm"
                          />
                          <Badge variant="secondary">
                            {groupCQs.length} questions
                          </Badge>
                        </div>
                      </div>
                      <CardDescription className="text-xs">
                        {group.schemeKey}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        {groupCQs.map((cq, index) => (
                          <AccordionItem key={cq.id} value={cq.id}>
                            <AccordionTrigger className="text-left hover:no-underline">
                              <div className="flex items-start gap-3 flex-1">
                                <Badge variant="outline" className="shrink-0">
                                  CQ{index + 1}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {(cq as any).questionText || (cq as any).text || "No question text"}
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pt-2 pl-12">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Shield className="w-3 h-3" />
                                  <span>Attack type: {cq.attackType}</span>
                                </div>
                                {cq.targetsSchemeRole && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Target className="w-3 h-3" />
                                    <span>Targets: {cq.targetsSchemeRole} scheme</span>
                                  </div>
                                )}
                                {(cq as any).cqKey && (
                                  <div className="text-xs font-mono text-muted-foreground">
                                    {(cq as any).cqKey}
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>
          
          {/* By Attack Type Tab */}
          <TabsContent value="byAttack" className="mt-4 space-y-3">
            {composedSet.byAttackType
              .filter(group =>
                !hasActiveFilters ||
                filteredCQs.some(cq => cq.attackType === group.attackType)
              )
              .map(group => {
                const groupCQs = hasActiveFilters
                  ? filteredCQs.filter(cq => cq.attackType === group.attackType)
                  : group.cqs;
                
                if (groupCQs.length === 0) return null;
                
                return (
                  <Card key={group.attackType}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {group.displayName}
                        <Badge variant="secondary" className="ml-auto">
                          {groupCQs.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {groupCQs.map((cq, index) => (
                          <div key={cq.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                            <Badge variant="outline" className="shrink-0">
                              {index + 1}
                            </Badge>
                            <div className="flex-1 space-y-2">
                              <p className="text-sm font-medium">
                                {(cq as any).questionText || (cq as any).text || "No question text"}
                              </p>
                              <div className="flex items-center gap-2">
                                <MultiSchemeBadge
                                  schemeInstance={cq.sourceSchemeInstance}
                                  size="sm"
                                />
                                {cq.targetsSchemeRole && (
                                  <>
                                    <span className="text-xs text-muted-foreground">→</span>
                                    <Badge variant="outline" className="text-xs">
                                      Targets {cq.targetsSchemeRole}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>
          
          {/* By Target Tab */}
          <TabsContent value="byTarget" className="mt-4 space-y-3">
            {composedSet.byTarget.length > 0 ? (
              composedSet.byTarget
                .filter(group =>
                  !hasActiveFilters ||
                  filteredCQs.some(cq => cq.targetsSchemeRole === group.targetRole)
                )
                .map(group => {
                  const groupCQs = hasActiveFilters
                    ? filteredCQs.filter(cq => cq.targetsSchemeRole === group.targetRole)
                    : group.cqs;
                  
                  if (groupCQs.length === 0) return null;
                  
                  return (
                    <Card key={group.targetRole}>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Targeting {group.targetRole} scheme
                          <Badge variant="secondary" className="ml-auto">
                            {groupCQs.length}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {groupCQs.map((cq, index) => (
                            <div key={cq.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                              <Badge variant="outline" className="shrink-0">
                                {index + 1}
                              </Badge>
                              <div className="flex-1 space-y-2">
                                <p className="text-sm font-medium">
                                  {(cq as any).questionText || (cq as any).text || "No question text"}
                                </p>
                                <div className="flex items-center gap-2">
                                  <MultiSchemeBadge
                                    schemeInstance={cq.sourceSchemeInstance}
                                    size="sm"
                                  />
                                  <Badge variant="outline" className="text-xs">
                                    {cq.attackType}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p>No target information available for these questions</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
