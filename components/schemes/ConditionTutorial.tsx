/**
 * ConditionTutorial Component
 * 
 * Interactive tutorial/guide for using the identification conditions filter.
 * Walks users through the process step-by-step with examples.
 * 
 * Week 7, Task 7.4: Explanatory Text System
 */

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Target,
  Eye,
  Filter,
  Award,
} from "lucide-react";

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  example?: string;
  tips?: string[];
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "Welcome to Identification Conditions",
    description:
      "This tool helps you find the right argument scheme by identifying observable patterns in your argument. You'll select conditions that match what you see, and the system will show you which schemes fit best.",
    icon: <Target className="w-6 h-6" />,
    tips: [
      "No prior knowledge of schemes required",
      "Focus on what you can observe in the argument",
      "Multiple conditions usually give better results",
    ],
  },
  {
    title: "Step 1: Read Your Argument",
    description:
      "Start by carefully reading the argument you want to analyze. Pay attention to how it's structured, what evidence it uses, and what it's trying to accomplish.",
    icon: <Eye className="w-6 h-6" />,
    example:
      "\"Dr. Smith, a climate scientist with 20 years of experience, says that global temperatures are rising. Therefore, we should take action on climate change.\"",
    tips: [
      "Look for key phrases and signal words",
      "Notice who or what is being cited",
      "Identify the conclusion and how it's supported",
    ],
  },
  {
    title: "Step 2: Identify Observable Patterns",
    description:
      "Browse through the condition categories and check the boxes for patterns you observe in the argument. Don't worry about getting it perfect - you can adjust as you go.",
    icon: <Filter className="w-6 h-6" />,
    example:
      "In our example, you might check: 'Appeals to expert testimony' (Dr. Smith is cited as an expert) and 'About action' (it recommends taking action).",
    tips: [
      "Start with the most obvious patterns",
      "Check examples to understand each condition",
      "You can select multiple conditions from different categories",
    ],
  },
  {
    title: "Step 3: Review Match Results",
    description:
      "As you select conditions, the results panel updates in real-time. Schemes are scored based on how well they match your selections. Perfect matches (85%+) are the strongest fits.",
    icon: <Award className="w-6 h-6" />,
    example:
      "For our example, 'Expert Opinion' scheme would show as a perfect match because it strongly aligns with appeals to expert testimony.",
    tips: [
      "Perfect matches (green) are highly recommended",
      "Strong matches (sky) are also good candidates",
      "Click 'Show matched conditions' to see why each scheme fits",
    ],
  },
  {
    title: "Step 4: Refine Your Selection",
    description:
      "If you have too many results or the matches aren't quite right, adjust your condition selections. Add more specific conditions or remove ones that don't quite fit.",
    icon: <CheckCircle2 className="w-6 h-6" />,
    tips: [
      "More conditions = more precise results",
      "Use the quality filter to focus on best matches",
      "Try sorting by score to see the strongest matches first",
      "Click on schemes to see full details",
    ],
  },
];

interface ConditionTutorialProps {
  onClose?: () => void;
}

export function ConditionTutorial({ onClose }: ConditionTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const goToNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = tutorialSteps[currentStep];

  return (
    <Card className="p-6 panelv2">
      <div className="space-y-4">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            Step {currentStep + 1} of {tutorialSteps.length}
          </Badge>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Skip Tutorial
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-600 dark:bg-sky-400 transition-all duration-300"
            style={{
              width: `${((currentStep + 1) / tutorialSteps.length) * 100}%`,
            }}
          />
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-5 space-y-4">
          {/* Icon and Title */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-sky-100 dark:bg-sky-900 rounded-lg text-sky-600 dark:text-sky-400">
              {step.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">{step.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {step.description}
              </p>
            </div>
          </div>

          {/* Example */}
          {step.example && (
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-yellow-900 dark:text-yellow-100 uppercase tracking-wide mb-1">
                    Example
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    {step.example}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tips */}
          {step.tips && step.tips.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Tips
              </p>
              <ul className="space-y-2">
                {step.tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={goToPrevious}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          <div className="flex gap-1">
            {tutorialSteps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStep
                    ? "bg-sky-600 dark:bg-sky-400 w-6"
                    : "bg-gray-300 dark:bg-gray-700"
                }`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          {currentStep < tutorialSteps.length - 1 ? (
            <Button onClick={goToNext}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={onClose} variant="default">
              Get Started
              <CheckCircle2 className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
