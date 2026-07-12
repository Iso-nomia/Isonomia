"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  HelpCircle, 
  Network, 
  GitBranch,
  Eye,
  Target,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mock CQ data for testing
const generateMockCQs = () => {
  return [
    // Scheme-level CQs
    {
      id: "cq-1",
      type: "scheme" as const,
      targetSchemeId: "s1",
      questionText: "Are the climate scientists cited truly experts in their field?",
      questionCategory: "Source Credibility",
      priority: "high" as const,
      context: {
        netId: "test-net-1",
        schemeRole: "primary",
        netType: "convergent",
      },
      suggestedActions: ["Verify expert credentials", "Check for peer-reviewed publications", "Assess institutional affiliations"],
      relatedSchemes: ["s1"],
    },
    {
      id: "cq-2",
      type: "scheme" as const,
      targetSchemeId: "s1",
      questionText: "Is there consensus among experts, or are there significant dissenting opinions?",
      questionCategory: "Consensus",
      priority: "critical" as const,
      context: {
        netId: "test-net-1",
        schemeRole: "primary",
        netType: "convergent",
      },
      suggestedActions: ["Research dissenting views", "Evaluate consensus strength"],
      relatedSchemes: ["s1"],
    },
    {
      id: "cq-3",
      type: "scheme" as const,
      targetSchemeId: "s2",
      questionText: "Are the predicted consequences actually likely to occur?",
      questionCategory: "Consequence Likelihood",
      priority: "high" as const,
      context: {
        netId: "test-net-1",
        schemeRole: "supporting",
        netType: "convergent",
      },
      suggestedActions: ["Review scientific models", "Assess probability estimates"],
      relatedSchemes: ["s2"],
    },
    {
      id: "cq-4",
      type: "scheme" as const,
      targetSchemeId: "s3",
      questionText: "Is the Montreal Protocol truly analogous to climate change action?",
      questionCategory: "Analogy Strength",
      priority: "medium" as const,
      context: {
        netId: "test-net-1",
        schemeRole: "supporting",
        netType: "convergent",
      },
      suggestedActions: ["Compare scope and scale", "Identify key differences", "Assess transferability"],
      relatedSchemes: ["s3"],
    },
    // Dependency CQs
    {
      id: "cq-5",
      type: "dependency" as const,
      targetDependencyId: "dep-2",
      questionText: "Must causal warming be established before consequences can be predicted?",
      questionCategory: "Prerequisite Dependency",
      priority: "high" as const,
      context: {
        netId: "test-net-1",
        dependencyType: "prerequisite",
        netType: "convergent",
      },
      suggestedActions: ["Verify logical ordering", "Check for independent evidence"],
      relatedSchemes: ["s4", "s2"],
    },
    {
      id: "cq-6",
      type: "dependency" as const,
      targetDependencyId: "dep-3",
      questionText: "Why is the connection between consequences and expert opinion weak?",
      questionCategory: "Weak Dependency",
      priority: "high" as const,
      context: {
        netId: "test-net-1",
        dependencyType: "supporting",
        netType: "convergent",
      },
      suggestedActions: ["Strengthen the connection", "Add intermediate schemes", "Consider removing the dependency"],
      relatedSchemes: ["s2", "s1"],
    },
    {
      id: "cq-7",
      type: "dependency" as const,
      targetDependencyId: "dep-3",
      questionText: "Should the connection between Consequences and Expert Opinion be made more explicit?",
      questionCategory: "Explicitness",
      priority: "medium" as const,
      context: {
        netId: "test-net-1",
        dependencyType: "supporting",
        netType: "convergent",
      },
      suggestedActions: ["Add explicit connectives", "Use signposting language", "Add transitional text"],
      relatedSchemes: ["s2", "s1"],
    },
    // Net structure CQs
    {
      id: "cq-8",
      type: "net-structure" as const,
      questionText: "Is this argument net too complex (65/100) to be easily understood?",
      questionCategory: "Complexity",
      priority: "medium" as const,
      context: {
        netId: "test-net-1",
        netType: "convergent",
      },
      suggestedActions: ["Break into smaller sub-arguments", "Simplify dependencies", "Remove redundant schemes"],
      relatedSchemes: ["s1", "s2", "s3", "s4", "s5"],
    },
    {
      id: "cq-9",
      type: "net-structure" as const,
      questionText: "Is the critical path (Sign → Cause to Effect → Consequences → Expert Opinion) sound?",
      questionCategory: "Critical Path",
      priority: "high" as const,
      context: {
        netId: "test-net-1",
        netType: "convergent",
      },
      suggestedActions: ["Verify each step in the path", "Check for weak links", "Consider alternative paths"],
      relatedSchemes: ["s5", "s4", "s2", "s1"],
    },
    // Explicitness CQs
    {
      id: "cq-10",
      type: "explicitness" as const,
      targetSchemeId: "s3",
      questionText: "Should the use of Argument from Analogy be made more explicit?",
      questionCategory: "Scheme Explicitness",
      priority: "medium" as const,
      context: {
        netId: "test-net-1",
        schemeRole: "supporting",
        netType: "convergent",
      },
      suggestedActions: ["Add explicit marker like \"I argue using Argument from Analogy...\"", "State premises and conclusion clearly", "Clarify the reasoning pattern"],
      relatedSchemes: ["s3"],
    },
    {
      id: "cq-11",
      type: "scheme" as const,
      targetSchemeId: "s5",
      questionText: "Are the observed signs reliable indicators of the claimed effect?",
      questionCategory: "Sign Reliability",
      priority: "medium" as const,
      context: {
        netId: "test-net-1",
        schemeRole: "subordinate",
        netType: "convergent",
      },
      suggestedActions: ["Verify measurement accuracy", "Check for alternative explanations"],
      relatedSchemes: ["s5"],
    },
    {
      id: "cq-12",
      type: "dependency" as const,
      targetDependencyId: "dep-4",
      questionText: "Should the connection between Analogy and Expert Opinion be made more explicit?",
      questionCategory: "Explicitness",
      priority: "low" as const,
      context: {
        netId: "test-net-1",
        dependencyType: "supporting",
        netType: "convergent",
      },
      suggestedActions: ["Add explicit connectives", "Use signposting language"],
      relatedSchemes: ["s3", "s1"],
    },
  ];
};

interface MockComposedCQPanelProps {
  netId: string;
  onSchemeSelect?: (schemeId: string) => void;
  onDependencyHighlight?: (sourceId: string, targetId: string) => void;
  onAnswerSubmit?: (questionId: string, answer: string) => void;
}

export function MockComposedCQPanel({
  netId,
  onSchemeSelect,
  onDependencyHighlight,
  onAnswerSubmit,
}: MockComposedCQPanelProps) {
  const allQuestions = generateMockCQs();
  const [groupBy, setGroupBy] = useState<string>("scheme");
  const [filterPriority, setFilterPriority] = useState<string[]>([
    "critical",
    "high",
    "medium",
    "low",
  ]);
  const [filterType, setFilterType] = useState<string[]>([
    "scheme",
    "dependency",
    "net-structure",
    "explicitness",
  ]);

  // Helper functions
  const calculateGroupPriority = (questions: any[]): "critical" | "high" | "medium" | "low" => {
    if (questions.some((q) => q.priority === "critical")) return "critical";
    if (questions.some((q) => q.priority === "high")) return "high";
    if (questions.some((q) => q.priority === "medium")) return "medium";
    return "low";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case "scheme":
        return <HelpCircle className="w-4 h-4" />;
      case "dependency":
        return <GitBranch className="w-4 h-4" />;
      case "net-structure":
        return <Network className="w-4 h-4" />;
      case "explicitness":
        return <Eye className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return allQuestions.filter(
      (q) =>
        filterPriority.includes(q.priority) && filterType.includes(q.type)
    );
  }, [allQuestions, filterPriority, filterType]);

  // Group questions
  const groups = useMemo(() => {
    const grouped: any[] = [];

    if (groupBy === "scheme") {
      const schemeMap = new Map<string, any[]>();
      filteredQuestions.forEach((q) => {
        if (q.targetSchemeId) {
          if (!schemeMap.has(q.targetSchemeId)) {
            schemeMap.set(q.targetSchemeId, []);
          }
          schemeMap.get(q.targetSchemeId)!.push(q);
        }
      });
      schemeMap.forEach((qs, schemeId) => {
        grouped.push({
          groupType: "scheme",
          groupLabel: `Questions for Scheme ${schemeId}`,
          groupDescription: "Critical questions targeting this specific scheme",
          targetSchemeId: schemeId,
          questions: qs,
          priority: calculateGroupPriority(qs),
        });
      });
    } else if (groupBy === "dependency") {
      const depQuestions = filteredQuestions.filter((q) => q.type === "dependency");
      if (depQuestions.length > 0) {
        grouped.push({
          groupType: "dependency",
          groupLabel: "Dependency Questions",
          groupDescription: "Questions about relationships between schemes",
          questions: depQuestions,
          priority: calculateGroupPriority(depQuestions),
        });
      }
    } else if (groupBy === "attack-type") {
      const categoryMap = new Map<string, any[]>();
      filteredQuestions.forEach((q) => {
        if (!categoryMap.has(q.questionCategory)) {
          categoryMap.set(q.questionCategory, []);
        }
        categoryMap.get(q.questionCategory)!.push(q);
      });
      categoryMap.forEach((qs, category) => {
        grouped.push({
          groupType: "attack-type",
          groupLabel: category,
          groupDescription: `Questions in the "${category}" category`,
          questions: qs,
          priority: calculateGroupPriority(qs),
        });
      });
    } else if (groupBy === "burden") {
      const proponent = filteredQuestions.filter((q) =>
        q.questionCategory.includes("Support") || q.questionCategory.includes("Sufficiency")
      );
      const opponent = filteredQuestions.filter((q) =>
        q.questionCategory.includes("Counterexample") || q.questionCategory.includes("Alternative")
      );
      const shared = filteredQuestions.filter(
        (q) => !proponent.includes(q) && !opponent.includes(q)
      );
      if (proponent.length > 0) {
        grouped.push({
          groupType: "burden",
          groupLabel: "Proponent's Burden",
          groupDescription: "Questions that the argument maker should address",
          questions: proponent,
          priority: calculateGroupPriority(proponent),
        });
      }
      if (opponent.length > 0) {
        grouped.push({
          groupType: "burden",
          groupLabel: "Opponent's Burden",
          groupDescription: "Questions that challengers should address",
          questions: opponent,
          priority: calculateGroupPriority(opponent),
        });
      }
      if (shared.length > 0) {
        grouped.push({
          groupType: "burden",
          groupLabel: "Shared Burden",
          groupDescription: "Questions requiring collaborative exploration",
          questions: shared,
          priority: calculateGroupPriority(shared),
        });
      }
    } else if (groupBy === "priority") {
      const critical = filteredQuestions.filter((q) => q.priority === "critical");
      const high = filteredQuestions.filter((q) => q.priority === "high");
      const medium = filteredQuestions.filter((q) => q.priority === "medium");
      const low = filteredQuestions.filter((q) => q.priority === "low");
      
      if (critical.length > 0) {
        grouped.push({
          groupType: "net-level",
          groupLabel: "Critical Issues",
          groupDescription: "Must be addressed immediately",
          questions: critical,
          priority: "critical",
        });
      }
      if (high.length > 0) {
        grouped.push({
          groupType: "net-level",
          groupLabel: "High Priority",
          groupDescription: "Should be addressed soon",
          questions: high,
          priority: "high",
        });
      }
      if (medium.length > 0) {
        grouped.push({
          groupType: "net-level",
          groupLabel: "Medium Priority",
          groupDescription: "Important but not urgent",
          questions: medium,
          priority: "medium",
        });
      }
      if (low.length > 0) {
        grouped.push({
          groupType: "net-level",
          groupLabel: "Low Priority",
          groupDescription: "Optional improvements",
          questions: low,
          priority: "low",
        });
      }
    }

    return grouped;
  }, [filteredQuestions, groupBy]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Critical Questions</h2>
          <p className="text-sm text-gray-500">
            {filteredQuestions.length} questions for this argument net
          </p>
        </div>

        {/* Grouping Selector */}
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Group by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scheme">By Scheme</SelectItem>
            <SelectItem value="dependency">By Dependency</SelectItem>
            <SelectItem value="attack-type">By Attack Type</SelectItem>
            <SelectItem value="burden">By Burden</SelectItem>
            <SelectItem value="priority">By Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Priority Filter */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Priority</p>
            <div className="space-y-2">
              {["critical", "high", "medium", "low"].map((priority) => (
                <div key={priority} className="flex items-center space-x-2">
                  <Checkbox
                    id={`priority-${priority}`}
                    checked={filterPriority.includes(priority)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFilterPriority([...filterPriority, priority]);
                      } else {
                        setFilterPriority(
                          filterPriority.filter((p) => p !== priority)
                        );
                      }
                    }}
                  />
                  <Label
                    htmlFor={`priority-${priority}`}
                    className="capitalize cursor-pointer"
                  >
                    {priority}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Type</p>
            <div className="space-y-2">
              {["scheme", "dependency", "net-structure", "explicitness"].map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`type-${type}`}
                    checked={filterType.includes(type)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFilterType([...filterType, type]);
                      } else {
                        setFilterType(filterType.filter((t) => t !== type));
                      }
                    }}
                  />
                  <Label
                    htmlFor={`type-${type}`}
                    className="capitalize cursor-pointer"
                  >
                    {type.replace("-", " ")}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Question Groups */}
      <Accordion type="multiple" className="space-y-2">
        {groups.map((group, groupIndex) => (
          <AccordionItem
            key={groupIndex}
            value={`group-${groupIndex}`}
            className="border rounded-lg"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <Badge className={getPriorityColor(group.priority)}>
                    {group.priority}
                  </Badge>
                  <div className="text-left">
                    <p className="font-medium">{group.groupLabel}</p>
                    <p className="text-xs text-gray-500">
                      {group.groupDescription}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="ml-auto mr-2">
                  {group.questions.length} questions
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 mt-2">
                {group.questions.map((question: any) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    onSchemeClick={(id: string) => onSchemeSelect?.(id)}
                    onDependencyClick={() => {
                      if (question.relatedSchemes.length >= 2) {
                        onDependencyHighlight?.(
                          question.relatedSchemes[0],
                          question.relatedSchemes[1]
                        );
                      }
                    }}
                    onAnswerSubmit={onAnswerSubmit}
                    getPriorityColor={getPriorityColor}
                    getQuestionIcon={getQuestionIcon}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {groups.length === 0 && (
        <Card className="p-6">
          <p className="text-center text-gray-500">
            No questions match your current filters. Try adjusting the filter settings.
          </p>
        </Card>
      )}
    </div>
  );
}

// Question Card Component
function QuestionCard({
  question,
  onSchemeClick,
  onDependencyClick,
  onAnswerSubmit,
  getPriorityColor,
  getQuestionIcon,
}: any) {
  const [answerText, setAnswerText] = useState("");
  const [showActions, setShowActions] = useState(false);

  const handleSubmitAnswer = () => {
    if (onAnswerSubmit && answerText.trim()) {
      onAnswerSubmit(question.id, answerText);
      setAnswerText("");
    }
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Question Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1">
            <div className="mt-0.5">{getQuestionIcon(question.type)}</div>
            <div className="flex-1">
              <p className="font-medium text-sm leading-relaxed">
                {question.questionText}
              </p>
            </div>
          </div>
          <Badge className={cn("text-xs", getPriorityColor(question.priority))}>
            {question.priority}
          </Badge>
        </div>

        {/* Context */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="capitalize">
            {question.type.replace("-", " ")}
          </Badge>
          <Badge variant="outline">{question.questionCategory}</Badge>
          {question.context.schemeRole && (
            <Badge variant="outline" className="capitalize">
              {question.context.schemeRole} scheme
            </Badge>
          )}
        </div>

        {/* Targeting */}
        {(question.targetSchemeId || question.relatedSchemes.length > 0) && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600">Targets:</p>
            <div className="flex flex-wrap gap-2">
              {question.targetSchemeId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSchemeClick(question.targetSchemeId)}
                  className="h-7 text-xs"
                >
                  <Target className="w-3 h-3 mr-1" />
                  Scheme {question.targetSchemeId}
                </Button>
              )}
              {question.type === "dependency" && question.relatedSchemes.length >= 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDependencyClick}
                  className="h-7 text-xs"
                >
                  <GitBranch className="w-3 h-3 mr-1" />
                  {question.relatedSchemes[0]} <ArrowRight className="w-3 h-3 mx-1" />{" "}
                  {question.relatedSchemes[1]}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Suggested Actions */}
        {question.suggestedActions && question.suggestedActions.length > 0 && (
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowActions(!showActions)}
              className="h-7 text-xs"
            >
              {showActions ? "Hide" : "Show"} Suggested Actions
            </Button>
            {showActions && (
              <ul className="text-xs text-gray-600 space-y-1 ml-4 list-disc">
                {question.suggestedActions.map((action: string, idx: number) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Answer Input */}
        {onAnswerSubmit && (
          <div className="space-y-2 pt-2 border-t">
            <Textarea
              placeholder="Type your answer..."
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <Button
              size="sm"
              onClick={handleSubmitAnswer}
              disabled={!answerText.trim()}
              className="w-full"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Submit Answer
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
