// components/aspic/GroundedExtensionPanel.tsx
"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, ChevronDown, ChevronRight } from "lucide-react";
import { ExtensionStats } from "./ExtensionStats";
import { ArgumentStatusCard } from "./ArgumentStatusCard";

interface Argument {
  id: string;
  premises: string[];
  conclusion: string;
  defeasibleRules: string[];
  topRule: string | null;
  structure: string;
}

interface Attack {
  attackerId: string;
  attackedId: string;
  type: string;
}

interface GroundedExtension {
  inArguments?: string[];
  outArguments?: string[];
  undecidedArguments?: string[];
}

interface JustificationStatus {
  [argId: string]: "in" | "out" | "undec";
}

interface GroundedExtensionPanelProps {
  arguments: Argument[];
  semantics: {
    attacks: Attack[];
    defeats?: Array<{ defeaterId: string; defeatedId: string }>;
    groundedExtension: string[];
    justificationStatus: JustificationStatus;
  };
  /**
   * Phase D-1: when set, seeds the search box with this text so the user
   * lands on attacks/arguments involving the focused claim.
   */
  highlightClaimText?: string | null;
}

export function GroundedExtensionPanel({ arguments: args, semantics, highlightClaimText }: GroundedExtensionPanelProps) {
  const [searchQuery, setSearchQuery] = useState(highlightClaimText ?? "");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["in", "out"])
  );

  // Phase D-1: react to external focus changes (deep-link or badge click).
  React.useEffect(() => {
    if (highlightClaimText) {
      setSearchQuery(highlightClaimText);
      setExpandedSections(new Set(["in", "out", "undec"]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightClaimText]);

  // Debug logging
  console.log("[GroundedExtensionPanel] Received data:", {
    argsCount: args.length,
    firstArg: args[0],
    semantics: {
      attacksCount: semantics.attacks.length,
      groundedExtension: semantics.groundedExtension,
      justificationStatus: semantics.justificationStatus,
    },
  });

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Categorize arguments by status
  const { inArguments, outArguments, undecArguments } = useMemo(() => {
    const inArgs: Argument[] = [];
    const outArgs: Argument[] = [];
    const undecArgs: Argument[] = [];

    args.forEach((arg) => {
      const status = semantics.justificationStatus[arg.id];
      if (status === "in") {
        inArgs.push(arg);
      } else if (status === "out") {
        outArgs.push(arg);
      } else if (status === "undec") {
        undecArgs.push(arg);
      }
    });

    return { inArguments: inArgs, outArguments: outArgs, undecArguments: undecArgs };
  }, [args, semantics.justificationStatus]);

  // Filter arguments by search query
  const filterArguments = (argList: Argument[]) => {
    if (!searchQuery) return argList;
    const query = searchQuery.toLowerCase();
    return argList.filter(
      (arg) =>
        arg.id.toLowerCase().includes(query) ||
        arg.conclusion.toLowerCase().includes(query) ||
        arg.premises.some((p) => p.toLowerCase().includes(query))
    );
  };

  // Generate explanation for why an argument has a particular status
  const getJustificationExplanation = (
    arg: Argument,
    status: "in" | "out" | "undec"
  ): string => {
    if (status === "in") {
      const attackers = semantics.attacks.filter((a) => a.attackedId === arg.id);
      if (attackers.length === 0) {
        return "No attackers (defended by default)";
      }
      const defeatedAttackers = attackers.filter((a) =>
        semantics.justificationStatus[a.attackerId] === "out"
      );
      if (defeatedAttackers.length === attackers.length) {
        return `Defended: All ${attackers.length} attacker(s) are defeated`;
      }
      return `Defended: ${defeatedAttackers.length} of ${attackers.length} attackers defeated`;
    }

    if (status === "out") {
      const defeaters = semantics.attacks.filter(
        (a) =>
          a.attackedId === arg.id &&
          semantics.justificationStatus[a.attackerId] === "in"
      );
      if (defeaters.length > 0) {
        return `Defeated by: ${defeaters.map((d) => d.attackerId).join(", ")}`;
      }
      return "Defeated by justified argument(s)";
    }

    // UNDEC
    return "Undecided: Part of mutual defeat cycle or undefended";
  };

  const filteredInArgs = filterArguments(inArguments);
  const filteredOutArgs = filterArguments(outArguments);
  const filteredUndecArgs = filterArguments(undecArguments);

  const exportResults = () => {
    const data = {
      summary: {
        total: args.length,
        in: inArguments.length,
        out: outArguments.length,
        undec: undecArguments.length,
      },
      inArguments: inArguments.map((arg) => ({
        id: arg.id,
        conclusion: arg.conclusion,
        premises: arg.premises,
      })),
      outArguments: outArguments.map((arg) => ({
        id: arg.id,
        conclusion: arg.conclusion,
        premises: arg.premises,
      })),
      undecArguments: undecArguments.map((arg) => ({
        id: arg.id,
        conclusion: arg.conclusion,
        premises: arg.premises,
      })),
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grounded-extension.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <ExtensionStats
        inCount={inArguments.length}
        outCount={outArguments.length}
        undecCount={undecArguments.length}
        totalCount={args.length}
      />

      {/* Search and Export */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search arguments by ID, conclusion, or premises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportResults}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* IN Arguments */}
      <Card>
        <CardHeader className="pb-3">
          <button
            onClick={() => toggleSection("in")}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity w-full"
          >
            {expandedSections.has("in") ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <CardTitle className="text-base">
              ✅ Justified Arguments (IN) — {filteredInArgs.length}
            </CardTitle>
          </button>
        </CardHeader>
        {expandedSections.has("in") && (
          <CardContent className="space-y-2">
            {filteredInArgs.length > 0 ? (
              filteredInArgs.map((arg) => (
                <ArgumentStatusCard
                  key={arg.id}
                  argument={arg}
                  status="in"
                  explanation={getJustificationExplanation(arg, "in")}
                />
              ))
            ) : (
              <p className="text-sm text-gray-500">
                {searchQuery ? "No matching arguments" : "No justified arguments"}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* OUT Arguments */}
      <Card>
        <CardHeader className="pb-3">
          <button
            onClick={() => toggleSection("out")}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity w-full"
          >
            {expandedSections.has("out") ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <CardTitle className="text-base">
              ❌ Defeated Arguments (OUT) — {filteredOutArgs.length}
            </CardTitle>
          </button>
        </CardHeader>
        {expandedSections.has("out") && (
          <CardContent className="space-y-2">
            {filteredOutArgs.length > 0 ? (
              filteredOutArgs.map((arg) => (
                <ArgumentStatusCard
                  key={arg.id}
                  argument={arg}
                  status="out"
                  explanation={getJustificationExplanation(arg, "out")}
                />
              ))
            ) : (
              <p className="text-sm text-gray-500">
                {searchQuery ? "No matching arguments" : "No defeated arguments"}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* UNDEC Arguments */}
      {undecArguments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <button
              onClick={() => toggleSection("undec")}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity w-full"
            >
              {expandedSections.has("undec") ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <CardTitle className="text-base">
                ⚠️ Undecided Arguments (UNDEC) — {filteredUndecArgs.length}
              </CardTitle>
            </button>
          </CardHeader>
          {expandedSections.has("undec") && (
            <CardContent className="space-y-2">
              {filteredUndecArgs.length > 0 ? (
                filteredUndecArgs.map((arg) => (
                  <ArgumentStatusCard
                    key={arg.id}
                    argument={arg}
                    status="undec"
                    explanation={getJustificationExplanation(arg, "undec")}
                  />
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  {searchQuery ? "No matching arguments" : "No undecided arguments"}
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
