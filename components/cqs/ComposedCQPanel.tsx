"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertTriangle, 
  Network, 
  GitBranch,
  Eye,
  Target,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BurdenBadge } from "@/components/argumentation/BurdenOfProofIndicators";

// ============================================================================
// Types
// ============================================================================

interface NetCriticalQuestion {
  id: string;
  type: "scheme" | "dependency" | "net-structure" | "explicitness";
  targetSchemeId?: string;
  targetDependencyId?: string;
  questionText: string;
  questionCategory: string;
  priority: "critical" | "high" | "medium" | "low";
  burdenOfProof?: "proponent" | "challenger" | "PROPONENT" | "CHALLENGER";
  requiresEvidence?: boolean;
  context: {
    netId: string;
    schemeRole?: string;
    dependencyType?: string;
    netType?: string;
  };
  suggestedActions?: string[];
  relatedSchemes: string[];
}

interface NetCQGroup {
  groupType: "scheme" | "dependency" | "burden" | "attack-type" | "net-level";
  groupLabel: string;
  groupDescription: string;
  targetSchemeId?: string;
  questions: NetCriticalQuestion[];
  priority: "critical" | "high" | "medium" | "low";
}

interface ComposedCQPanelProps {
  netId: string;
  onSchemeSelect?: (schemeId: string) => void;
  onDependencyHighlight?: (sourceId: string, targetId: string) => void;
  onAnswerSubmit?: (questionId: string, answer: string) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function ComposedCQPanel({
  netId,
  onSchemeSelect,
  onDependencyHighlight,
  onAnswerSubmit,
}: ComposedCQPanelProps) {
  const [groups, setGroups] = useState<NetCQGroup[]>([]);
  const [questions, setQuestions] = useState<NetCriticalQuestion[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Load CQs
  useEffect(() => {
    loadCQs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netId, groupBy]);

  const loadCQs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/nets/${netId}/cqs?groupBy=${groupBy}`);
      const data = await response.json();

      if (data.groups) {
        setGroups(data.groups);
      } else if (data.questions) {
        setQuestions(data.questions);
      }
    } catch (error) {
      console.error("Failed to load CQs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter groups/questions
  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        questions: group.questions.filter(
          (q) =>
            filterPriority.includes(q.priority) && filterType.includes(q.type)
        ),
      }))
      .filter((group) => group.questions.length > 0);
  }, [groups, filterPriority, filterType]);

  // Handle scheme click
  const handleSchemeClick = (schemeId: string) => {
    if (onSchemeSelect) {
      onSchemeSelect(schemeId);
    }
  };

  // Handle dependency highlight
  const handleDependencyClick = (question: NetCriticalQuestion) => {
    if (onDependencyHighlight && question.relatedSchemes.length >= 2) {
      onDependencyHighlight(
        question.relatedSchemes[0],
        question.relatedSchemes[1]
      );
    }
  };

  // Get icon for question type
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

  // Get badge color for priority
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-sky-100 text-sky-800 border-sky-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">Loading critical questions...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Critical Questions</h2>
          <p className="text-sm text-gray-500">
            {filteredGroups.reduce((sum, g) => sum + g.questions.length, 0)}{" "}
            questions for this argument net
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
        {filteredGroups.map((group, groupIndex) => (
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
                {group.questions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    onSchemeClick={handleSchemeClick}
                    onDependencyClick={() => handleDependencyClick(question)}
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

      {filteredGroups.length === 0 && (
        <Card className="p-6">
          <p className="text-center text-gray-500">
            No questions match your current filters. Try adjusting the filter
            settings.
          </p>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Question Card Component
// ============================================================================

interface QuestionCardProps {
  question: NetCriticalQuestion;
  onSchemeClick: (schemeId: string) => void;
  onDependencyClick: () => void;
  onAnswerSubmit?: (questionId: string, answer: string) => void;
  getPriorityColor: (priority: string) => string;
  getQuestionIcon: (type: string) => React.ReactNode;
}

function QuestionCard({
  question,
  onSchemeClick,
  onDependencyClick,
  onAnswerSubmit,
  getPriorityColor,
  getQuestionIcon,
}: QuestionCardProps) {
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
          <div className="flex items-center gap-2">
            {question.burdenOfProof && (
              <BurdenBadge 
                burden={question.burdenOfProof} 
                requiresEvidence={question.requiresEvidence}
                className="shrink-0"
              />
            )}
            <Badge className={cn("text-xs shrink-0", getPriorityColor(question.priority))}>
              {question.priority}
            </Badge>
          </div>
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
                  onClick={() => onSchemeClick(question.targetSchemeId!)}
                  className="h-7 text-xs"
                >
                  <Target className="w-3 h-3 mr-1" />
                  {(question as any).targetSchemeName || `Scheme ${question.targetSchemeId}`}
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
                {question.suggestedActions.map((action, idx) => (
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
