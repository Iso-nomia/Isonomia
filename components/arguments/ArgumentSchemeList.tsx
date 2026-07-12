// components/arguments/ArgumentSchemeList.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiSchemeBadge } from "./MultiSchemeBadge";
import { SchemeInstanceActions } from "./SchemeInstanceActions";
import type { ArgumentWithSchemes, ArgumentSchemeInstanceWithScheme } from "@/lib/types/argument-net";
import { 
  getPrimaryScheme, 
  getSupportingSchemes, 
  getImplicitSchemes,
  getPresupposedSchemes,
  isMultiSchemeArgument
} from "@/lib/utils/argument-net-helpers";
import { Layers, FileText, Eye, HelpCircle, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ArgumentSchemeListProps {
  argument: ArgumentWithSchemes;
  variant?: "compact" | "detailed";
  showLegend?: boolean;
  showConfidence?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onSchemeClick?: (schemeInstanceId: string) => void;
  // Edit mode props
  editMode?: boolean;
  onEdit?: (schemeInstance: ArgumentSchemeInstanceWithScheme) => void;
  onAdd?: () => void;
  onActionSuccess?: () => void;
}

/**
 * ArgumentSchemeList - Display all schemes used in an argument
 * 
 * Features:
 * - Organized by role: primary, supporting, implicit/presupposed
 * - Compact variant: inline badges with counts
 * - Detailed variant: card with sections and descriptions
 * - Optional legend for explicitness border styles
 * - Collapsible sections
 * - Clickable scheme badges
 * - Edit mode: Add action buttons for each scheme, show +Add button
 */

// Helper component for displaying a scheme badge with optional action menu
function SchemeBadgeWithActions({
  schemeInstance,
  showConfidence,
  editMode,
  canMoveUp,
  canMoveDown,
  canSetPrimary,
  argumentId,
  onSchemeClick,
  onEdit,
  onActionSuccess
}: {
  schemeInstance: ArgumentSchemeInstanceWithScheme;
  showConfidence: boolean;
  editMode: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canSetPrimary: boolean;
  argumentId: string;
  onSchemeClick?: (id: string) => void;
  onEdit?: (si: ArgumentSchemeInstanceWithScheme) => void;
  onActionSuccess?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <MultiSchemeBadge 
        schemeInstance={schemeInstance} 
        size="md"
        showConfidence={showConfidence}
        onClick={onSchemeClick ? () => onSchemeClick(schemeInstance.id) : undefined}
      />
      {editMode && (
        <SchemeInstanceActions
          argumentId={argumentId}
          schemeInstance={schemeInstance}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          canSetPrimary={canSetPrimary}
          onEdit={() => onEdit?.(schemeInstance)}
          onSuccess={onActionSuccess}
        />
      )}
    </div>
  );
}

export function ArgumentSchemeList({ 
  argument, 
  variant = "detailed",
  showLegend = true,
  showConfidence = false,
  collapsible = false,
  defaultExpanded = true,
  onSchemeClick,
  editMode = false,
  onEdit,
  onAdd,
  onActionSuccess
}: ArgumentSchemeListProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  const primaryScheme = getPrimaryScheme(argument);
  const supportingSchemes = getSupportingSchemes(argument);
  const presupposedSchemes = getPresupposedSchemes(argument);
  const implicitSchemes = getImplicitSchemes(argument);
  const allImplicit = [...presupposedSchemes, ...implicitSchemes];
  
  if (!primaryScheme && argument.argumentSchemes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No schemes identified for this argument
      </div>
    );
  }
  
  // Compact variant - inline badges
  if (variant === "compact") {
    return (
      <div className="flex flex-wrap gap-2 items-center">
        {primaryScheme && (
          <MultiSchemeBadge 
            schemeInstance={primaryScheme} 
            size="sm"
            showConfidence={showConfidence}
            onClick={onSchemeClick ? () => onSchemeClick(primaryScheme.id) : undefined}
          />
        )}
        
        {supportingSchemes.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground">+</span>
            {supportingSchemes.map(si => (
              <MultiSchemeBadge 
                key={si.id} 
                schemeInstance={si} 
                size="sm"
                showConfidence={showConfidence}
                onClick={onSchemeClick ? () => onSchemeClick(si.id) : undefined}
              />
            ))}
          </>
        )}
        
        {allImplicit.length > 0 && (
          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
            <Eye className="w-3 h-3 mr-1" />
            {allImplicit.length} implicit
          </Badge>
        )}
      </div>
    );
  }
  
  // Detailed variant - card with sections
  const totalSchemes = argument.argumentSchemes.length;
  const isMulti = isMultiSchemeArgument(argument);
  
  return (
    <Card>
      <CardHeader className={cn(collapsible && "cursor-pointer")} onClick={() => collapsible && setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              {collapsible && (
                expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              )}
              Argumentation Scheme{totalSchemes !== 1 ? "s" : ""} Used
              <Badge variant="secondary" className="ml-2">
                {totalSchemes}
              </Badge>
            </CardTitle>
            <CardDescription>
              {isMulti 
                ? `This argument combines ${totalSchemes} schemes to support its inference`
                : "The inferential pattern used in this argument"
              }
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent className="space-y-4">
          {/* Primary scheme */}
          {primaryScheme && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-sky-600" />
                <h4 className="text-sm font-semibold text-slate-900">Primary Scheme</h4>
                <Badge variant="outline" className="text-xs bg-sky-50 text-sky-700">
                  Main inferential pattern
                </Badge>
              </div>
              <SchemeBadgeWithActions
                schemeInstance={primaryScheme}
                showConfidence={showConfidence}
                editMode={editMode}
                canMoveUp={false}
                canMoveDown={false}
                canSetPrimary={false}
                argumentId={argument.id}
                onSchemeClick={onSchemeClick}
                onEdit={onEdit}
                onActionSuccess={onActionSuccess}
              />
              {primaryScheme.scheme?.summary && (
                <p className="text-xs text-muted-foreground mt-2 ml-1">
                  {primaryScheme.scheme.summary}
                </p>
              )}
            </div>
          )}
          
          {/* Supporting schemes */}
          {supportingSchemes.length > 0 && (
            <>
              <hr className="border-t border-slate-200" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-green-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Supporting Schemes</h4>
                  <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
                    {supportingSchemes.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Additional patterns that strengthen the main inference
                </p>
                <div className="space-y-3">
                  {supportingSchemes.map((si, index) => (
                    <div key={si.id}>
                      <SchemeBadgeWithActions
                        schemeInstance={si}
                        showConfidence={showConfidence}
                        editMode={editMode}
                        canMoveUp={index > 0}
                        canMoveDown={index < supportingSchemes.length - 1}
                        canSetPrimary={!primaryScheme}
                        argumentId={argument.id}
                        onSchemeClick={onSchemeClick}
                        onEdit={onEdit}
                        onActionSuccess={onActionSuccess}
                      />
                      {si.scheme?.summary && (
                        <p className="text-xs text-muted-foreground mt-1 ml-1">
                          {si.scheme.summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {/* Implicit schemes (presupposed + implicit) */}
          {allImplicit.length > 0 && (
            <>
              <hr className="border-t border-slate-200" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-4 h-4 text-amber-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Implicit Schemes</h4>
                  <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700">
                    {allImplicit.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  These schemes are presupposed or implied by the argument structure and have been reconstructed by analysts
                </p>
                <div className="space-y-3">
                  {allImplicit.map((si, index) => (
                    <div key={si.id} className="bg-amber-50/30 p-2 rounded-lg border border-amber-200/50">
                      <SchemeBadgeWithActions
                        schemeInstance={si}
                        showConfidence={showConfidence}
                        editMode={editMode}
                        canMoveUp={index > 0}
                        canMoveDown={index < allImplicit.length - 1}
                        canSetPrimary={!primaryScheme}
                        argumentId={argument.id}
                        onSchemeClick={onSchemeClick}
                        onEdit={onEdit}
                        onActionSuccess={onActionSuccess}
                      />
                      {(si as any).justification && (
                        <p className="text-xs text-muted-foreground mt-2 ml-1 italic">
                          <span className="font-medium">Reconstructed:</span> {(si as any).justification}
                        </p>
                      )}
                      {(si as any).textEvidence && (
                        <p className="text-xs text-amber-700 mt-1 ml-1">
                          <span className="font-medium">Evidence:</span> &quot;{(si as any).textEvidence}&quot;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {/* Add Scheme button (edit mode only) */}
          {editMode && onAdd && (
            <>
              <hr className="border-t border-slate-200" />
              <Button
                variant="outline"
                size="sm"
                onClick={onAdd}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Scheme
              </Button>
            </>
          )}
          
          {/* Legend for explicitness styles */}
          {showLegend && isMulti && (
            <>
              <hr className="border-t border-slate-200" />
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                  <h4 className="text-xs font-semibold text-muted-foreground">
                    Border Style Legend
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-4 border-2 border-solid border-sky-500 rounded bg-sky-50" />
                    <div>
                      <p className="font-medium text-slate-700">Explicit</p>
                      <p className="text-[10px] text-muted-foreground">Stated in text</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-4 border-2 border-dashed border-amber-500 rounded bg-amber-50" />
                    <div>
                      <p className="font-medium text-slate-700">Presupposed</p>
                      <p className="text-[10px] text-muted-foreground">Assumed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-4 border-2 border-dotted border-gray-400 rounded bg-gray-50" />
                    <div>
                      <p className="font-medium text-slate-700">Implied</p>
                      <p className="text-[10px] text-muted-foreground">Inferred</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
