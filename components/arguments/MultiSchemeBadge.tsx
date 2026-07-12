// components/arguments/MultiSchemeBadge.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Layers, FileText, Eye, EyeOff } from "lucide-react";
import type {
  ArgumentSchemeInstanceWithScheme,
  ExplicitnessLevel,
  SchemeRole,
} from "@/lib/types/argument-net";
import { getExplicitnessStyle, getRoleStyle } from "@/lib/utils/argument-net-helpers";
import { cn } from "@/lib/utils";

interface MultiSchemeBadgeProps {
  schemeInstance: ArgumentSchemeInstanceWithScheme;
  size?: "sm" | "md" | "lg";
  showExplicitness?: boolean;
  showConfidence?: boolean;
  onClick?: () => void;
}

/**
 * MultiSchemeBadge - Display a single scheme instance with role and explicitness styling
 * 
 * Features:
 * - Role-based colors (primary: blue, supporting: green, presupposed: amber, implicit: gray)
 * - Role icons (Layers, FileText, Eye, EyeOff)
 * - Explicitness border styling (solid/dashed/dotted)
 * - Tooltip with scheme details, evidence, justification, and CQ count
 * - Optional confidence display
 * - Clickable for interactions
 */
export function MultiSchemeBadge({ 
  schemeInstance, 
  size = "md", 
  showExplicitness = true,
  showConfidence = false,
  onClick
}: MultiSchemeBadgeProps) {
  const explicitnessStyle = getExplicitnessStyle(
    schemeInstance.explicitness as ExplicitnessLevel
  );
  const roleStyle = getRoleStyle(schemeInstance.role as SchemeRole);
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  };
  
  const iconSize = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5"
  };
  
  const RoleIcon = {
    primary: Layers,
    supporting: FileText,
    presupposed: Eye,
    implicit: EyeOff
  }[schemeInstance.role as SchemeRole];
  
  const badgeContent = (
    <Badge
      variant="outline"
      className={cn(
        sizeClasses[size],
        roleStyle.bgColor,
        roleStyle.color,
        roleStyle.borderColor,
        showExplicitness && `border-${explicitnessStyle.borderStyle}`,
        onClick && "cursor-pointer hover:shadow-md",
        !onClick && "cursor-help",
        "transition-all inline-flex items-center gap-1.5"
      )}
      onClick={onClick}
    >
      {/* Role icon */}
      <RoleIcon className={cn(iconSize[size], "shrink-0")} />
      
      {/* Scheme name */}
      <span className="font-medium">
        {schemeInstance.scheme?.name || "Unknown Scheme"}
      </span>
      
      {/* Confidence indicator */}
      {showConfidence && schemeInstance.confidence !== undefined && (
        <span className={cn(
          "ml-1 font-semibold",
          schemeInstance.confidence >= 0.8 ? "text-green-700" :
          schemeInstance.confidence >= 0.5 ? "text-amber-700" :
          "text-red-700"
        )}>
          {Math.round(schemeInstance.confidence * 100)}%
        </span>
      )}
      
      {/* Primary indicator */}
      {schemeInstance.isPrimary && (
        <span className="ml-0.5 text-yellow-600" title="Primary scheme">
          ★
        </span>
      )}
    </Badge>
  );
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        
        <TooltipContent side="bottom" className="max-w-sm">
          <div className="space-y-2">
            {/* Scheme name and role */}
            <div>
              <p className="font-semibold text-sm">
                {schemeInstance.scheme?.name || "Unknown Scheme"}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {roleStyle.label} • {explicitnessStyle.label}
              </p>
            </div>
            
            {/* Scheme summary */}
            {schemeInstance.scheme?.summary && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  {schemeInstance.scheme.summary}
                </p>
              </div>
            )}
            
            {/* Confidence level */}
            {schemeInstance.confidence !== undefined && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium">Confidence</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all",
                        schemeInstance.confidence >= 0.8 ? "bg-green-500" :
                        schemeInstance.confidence >= 0.5 ? "bg-amber-500" :
                        "bg-red-500"
                      )}
                      style={{ width: `${schemeInstance.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold">
                    {Math.round(schemeInstance.confidence * 100)}%
                  </span>
                </div>
              </div>
            )}
            
            {/* Explicitness info */}
            {showExplicitness && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium">{explicitnessStyle.label}</p>
                <p className="text-xs text-muted-foreground">
                  {explicitnessStyle.description}
                </p>
              </div>
            )}
            
            {/* Text evidence if available */}
            {schemeInstance.textEvidence && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium">Evidence in text:</p>
                <p className="text-xs text-muted-foreground italic">
                  &quot;{schemeInstance.textEvidence}&quot;
                </p>
              </div>
            )}
            
            {/* Justification for implicit/presupposed */}
            {(schemeInstance.role === "presupposed" || schemeInstance.role === "implicit") 
              && schemeInstance.justification && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium">Why reconstructed:</p>
                <p className="text-xs text-muted-foreground">
                  {schemeInstance.justification}
                </p>
              </div>
            )}
            
            {/* Order indicator */}
            {schemeInstance.order !== undefined && schemeInstance.order > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Order: #{schemeInstance.order}
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
