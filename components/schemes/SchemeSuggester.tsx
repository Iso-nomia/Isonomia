// components/schemes/SchemeSuggester.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { suggestSchemes, type SchemeMatch } from "@/lib/utils/scheme-suggestion";
import { Lightbulb, Sparkles, Target, TrendingUp } from "lucide-react";

type SchemeSuggesterProps = {
  onSelectScheme?: (schemeKey: string) => void;
  className?: string;
};

export function SchemeSuggester({ onSelectScheme, className }: SchemeSuggesterProps) {
  const [userInput, setUserInput] = useState("");
  const [suggestions, setSuggestions] = useState<SchemeMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [allSchemes, setAllSchemes] = useState<any[]>([]);

  // Load schemes on mount
  React.useEffect(() => {
    const loadSchemes = async () => {
      try {
        const res = await fetch("/api/schemes");
        if (res.ok) {
          const data = await res.json();
          setAllSchemes(data.schemes || []);
        }
      } catch (err) {
        console.error("Failed to load schemes:", err);
      }
    };
    loadSchemes();
  }, []);

  const handleSuggest = () => {
    if (!userInput.trim() || allSchemes.length === 0) return;

    setLoading(true);
    
    // Simulate brief processing time for UX
    setTimeout(() => {
      const matches = suggestSchemes(userInput, allSchemes, {
        maxResults: 5,
        minScore: 0.15,
      });
      
      setSuggestions(matches);
      setLoading(false);
    }, 300);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-100 text-green-800 border-green-300";
      case "intermediate":
        return "bg-sky-100 text-sky-800 border-sky-300";
      case "advanced":
        return "bg-purple-100 text-purple-800 border-purple-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  return (
    <div className={className}>
      <Card className="p-6 bg-gradient-to-br from-sky-50 to-cyan-50 border-sky-200">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-sky-100 shrink-0">
              <Lightbulb className="w-5 h-5 text-sky-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-sky-900">Find the Right Argumentation Scheme</h3>
              <p className="text-sm text-sky-700 mt-1">
                Describe your argument or claim, and we&apos;ll suggest applicable schemes based on Walton&apos;s identification conditions.
              </p>
            </div>
          </div>

          {/* Input Area */}
          <div className="space-y-3">
            <Textarea
              placeholder="Example: I want to argue that we should trust climate scientists because they have decades of research experience..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              rows={4}
              className="bg-white/80 border-sky-300 focus:border-sky-500 rounded-lg resize-none"
            />
            
            <Button
              onClick={handleSuggest}
              disabled={!userInput.trim() || loading || allSchemes.length === 0}
              className="w-full bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white"
            >
              {loading ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Finding matches...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 mr-2" />
                  Suggest Schemes
                </>
              )}
            </Button>
          </div>

          {/* Results */}
          {suggestions.length > 0 && (
            <div className="space-y-3 mt-6 pt-6 border-t border-sky-300">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-700" />
                <h4 className="text-sm font-semibold text-sky-900">
                  Suggested Schemes ({suggestions.length})
                </h4>
              </div>

              {suggestions.map((match) => (
                <Card
                  key={match.schemeKey}
                  className="p-4 bg-white border-sky-200 hover:border-sky-400 transition-all cursor-pointer"
                  onClick={() => onSelectScheme?.(match.schemeKey)}
                >
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-bold text-slate-900">
                            {match.schemeName}
                          </h5>
                          <Badge
                            variant="outline"
                            className={`text-xs ${getDifficultyColor(match.difficulty)}`}
                          >
                            {match.difficulty}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">
                          {match.schemeKey}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="px-2 py-1 rounded-full bg-sky-100 border border-sky-300">
                          <span className="text-xs font-semibold text-sky-700">
                            {Math.round(match.score * 100)}% match
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* When to Use */}
                    {match.whenToUse && (
                      <div className="p-2 bg-slate-50 rounded border border-slate-200">
                        <p className="text-xs text-slate-700 leading-relaxed">
                          <span className="font-semibold">When to use:</span> {match.whenToUse}
                        </p>
                      </div>
                    )}

                    {/* Matched Conditions */}
                    {match.matchedConditions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {match.matchedConditions.map((condition, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs bg-sky-100 text-sky-800 border-sky-300"
                          >
                            ✓ {condition}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Tags */}
                    {match.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {match.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs bg-slate-100 text-slate-600 border-slate-300"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* No Results */}
          {suggestions.length === 0 && userInput.trim() && !loading && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mt-4">
              <p className="text-sm text-amber-800">
                No schemes matched your description. Try describing your argument differently or using keywords like &quot;expert&quot;, &quot;cause&quot;, &quot;similar&quot;, or &quot;consequence&quot;.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
