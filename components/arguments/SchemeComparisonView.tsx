// components/arguments/SchemeComparisonView.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MultiSchemeBadge } from "./MultiSchemeBadge";
import type { ArgumentWithSchemes, ArgumentSchemeInstanceWithScheme } from "@/lib/types/argument-net";
import { 
  getPrimaryScheme, 
  getSupportingSchemes,
  getSchemeCount 
} from "@/lib/utils/argument-net-helpers";
import { 
  Layers, 
  FileText, 
  HelpCircle, 
  ArrowRight, 
  CheckCircle2,
  Circle,
  TrendingUp
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SchemeComparisonViewProps {
  argument: ArgumentWithSchemes;
  showCQComparison?: boolean;
  compact?: boolean;
}

/**
 * SchemeComparisonView - Side-by-side comparison of multiple schemes
 * 
 * Features:
 * - Compare primary vs supporting schemes
 * - Show CQ differences between schemes
 * - Display inferential patterns
 * - Highlight scheme strengths
 * - Show confidence levels
 */
export function SchemeComparisonView({ 
  argument,
  showCQComparison = true,
  compact = false
}: SchemeComparisonViewProps) {
  const [selectedScheme, setSelectedScheme] = useState<string | null>(null);
  
  const primaryScheme = getPrimaryScheme(argument);
  const supportingSchemes = getSupportingSchemes(argument);
  const schemeCount = getSchemeCount(argument);
  
  if (schemeCount < 2) {
    return (
      <div className="text-sm text-muted-foreground p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p>At least 2 schemes are needed for comparison. This argument uses {schemeCount} scheme{schemeCount !== 1 ? "s" : ""}.</p>
      </div>
    );
  }
  
  const schemesToCompare = [
    primaryScheme,
    ...supportingSchemes
  ].filter(Boolean) as ArgumentSchemeInstanceWithScheme[];
  
  if (compact) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {schemesToCompare.map(scheme => (
          <SchemeComparisonCard
            key={scheme.id}
            scheme={scheme}
            showCQComparison={showCQComparison}
            isSelected={selectedScheme === scheme.id}
            onClick={() => setSelectedScheme(scheme.id === selectedScheme ? null : scheme.id)}
          />
        ))}
      </div>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          Scheme Comparison
        </CardTitle>
        <CardDescription>
          Compare {schemeCount} schemes used in this argument
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {schemesToCompare.map((scheme, index) => (
            <div key={scheme.id} className="relative">
              {index > 0 && (
                <div className="hidden lg:block absolute -left-3 top-1/2 transform -translate-y-1/2 z-10">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-indigo-600" />
                  </div>
                </div>
              )}
              <SchemeComparisonCard
                scheme={scheme}
                showCQComparison={showCQComparison}
                isSelected={selectedScheme === scheme.id}
                onClick={() => setSelectedScheme(scheme.id === selectedScheme ? null : scheme.id)}
                isPrimary={scheme.isPrimary}
              />
            </div>
          ))}
        </div>
        
        {/* Comparison insights */}
        {schemesToCompare.length >= 2 && (
          <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <h4 className="text-sm font-semibold text-indigo-900 mb-2">Comparison Insights</h4>
            <ul className="text-xs text-indigo-700 space-y-1">
              <li>• {primaryScheme?.scheme?.name || "Primary scheme"} provides the main inferential pattern</li>
              {supportingSchemes.length > 0 && (
                <li>• {supportingSchemes.length} supporting scheme{supportingSchemes.length > 1 ? "s" : ""} strengthen{supportingSchemes.length === 1 ? "s" : ""} different aspects</li>
              )}
              <li>• Multiple schemes provide redundant support and multiple attack surfaces</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Sub-component for individual scheme comparison card
function SchemeComparisonCard({
  scheme,
  showCQComparison,
  isSelected,
  onClick,
  isPrimary
}: {
  scheme: ArgumentSchemeInstanceWithScheme;
  showCQComparison?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  isPrimary?: boolean;
}) {
  const schemeData = scheme.scheme as any;
  const cqCount =
    (Array.isArray(schemeData?.cqs) ? schemeData.cqs.length : undefined) ??
    (Array.isArray(schemeData?.criticalQuestions) ? schemeData.criticalQuestions.length : 0) ??
    0;
  const confidence = scheme.confidence || 0;
  
  return (
    <div
      className={cn(
        "p-4 rounded-lg border-2 transition-all cursor-pointer",
        isSelected 
          ? "border-indigo-500 bg-indigo-50 shadow-lg" 
          : "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md",
        isPrimary && "ring-2 ring-sky-400 ring-offset-2"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <MultiSchemeBadge 
            schemeInstance={scheme} 
            size="sm"
            showConfidence={false}
          />
          {isPrimary && (
            <Badge className="text-xs bg-sky-600 text-white">
              Primary
            </Badge>
          )}
        </div>
        
        {/* Confidence bar */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Confidence</span>
            <span className="font-semibold">{Math.round(confidence * 100)}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all",
                confidence >= 0.8 ? "bg-green-500" :
                confidence >= 0.5 ? "bg-amber-500" :
                "bg-red-500"
              )}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Scheme summary */}
      {scheme.scheme?.summary && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {scheme.scheme.summary}
        </p>
      )}
      
      {/* Premises pattern */}
      {Array.isArray(schemeData?.premises) && schemeData.premises.length > 0 && (
        <div className="mb-3">
          <h5 className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Premises Pattern
          </h5>
          <div className="space-y-1">
            {schemeData.premises.slice(0, 3).map((premise: any, idx: number) => (
              <div key={idx} className="text-xs text-slate-600 flex items-start gap-1">
                <span className="text-muted-foreground mt-0.5">•</span>
                <span className="line-clamp-1">{premise.text || premise}</span>
              </div>
            ))}
            {schemeData.premises.length > 3 && (
              <div className="text-xs text-muted-foreground italic">
                +{schemeData.premises.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* CQ comparison */}
      {showCQComparison && cqCount > 0 && (
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-slate-500" />
              <span className="text-xs font-medium text-slate-700">
                Critical Questions
              </span>
            </div>
            <Badge variant="outline" className="text-xs">
              {cqCount}
            </Badge>
          </div>
          
          {/* Placeholder for actual CQ status */}
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Circle className="w-3 h-3" />
            <span>Click to view questions</span>
          </div>
        </div>
      )}
      
      {/* Explicitness indicator */}
      <div className="mt-3 pt-3 border-t border-slate-200">
        <div className="text-xs">
          <span className="text-muted-foreground">Explicitness: </span>
          <span className={cn(
            "font-medium capitalize",
            scheme.explicitness === "explicit" ? "text-sky-700" :
            scheme.explicitness === "presupposed" ? "text-amber-700" :
            "text-gray-700"
          )}>
            {scheme.explicitness || "explicit"}
          </span>
        </div>
      </div>
    </div>
  );
}
