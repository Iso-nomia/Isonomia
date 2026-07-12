/**
 * Composer for author responses to reviewer commitments
 */

"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  HelpCircle,
  FileEdit,
  CheckCircle,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react";
import { useCreateAuthorResponse, useAuthorResponses } from "@/lib/review/hooks";

interface Commitment {
  id: string;
  type: "CONCERN" | "QUESTION" | "REQUIRED_CHANGE" | "SUGGESTION";
  content: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  resolved: boolean;
  reviewer?: {
    name: string | null;
    email: string | null;
  };
}

interface AuthorResponseComposerProps {
  reviewId: string;
  commitment: Commitment;
  onSuccess?: () => void;
}

const responseMoves = [
  {
    value: "CONCEDE",
    label: "Concede",
    description: "Accept the reviewer's point and commit to action",
  },
  {
    value: "PARTIAL_CONCEDE",
    label: "Partial Concede",
    description: "Accept part of the point with modifications",
  },
  {
    value: "DEFEND",
    label: "Defend",
    description: "Provide defense for the current approach",
  },
  {
    value: "CLARIFY",
    label: "Clarify",
    description: "Provide clarification for a misunderstanding",
  },
  {
    value: "QUESTION",
    label: "Question",
    description: "Ask for more information or specifics",
  },
  {
    value: "DEFER",
    label: "Defer",
    description: "Defer to future work or other considerations",
  },
];

const typeConfig: Record<
  Commitment["type"],
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  CONCERN: { icon: AlertTriangle, color: "text-orange-500" },
  QUESTION: { icon: HelpCircle, color: "text-blue-500" },
  REQUIRED_CHANGE: { icon: FileEdit, color: "text-red-500" },
  SUGGESTION: { icon: CheckCircle, color: "text-green-500" },
};

export function AuthorResponseComposer({
  reviewId,
  commitment,
  onSuccess,
}: AuthorResponseComposerProps) {
  const [open, setOpen] = useState(false);
  const [responseMove, setResponseMove] = useState<string>("");
  const [content, setContent] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [phaseId, setPhaseId] = useState("");

  const createResponse = useCreateAuthorResponse(reviewId);
  const { data: existingResponses } = useAuthorResponses(reviewId);

  const TypeIcon = typeConfig[commitment.type]?.icon || HelpCircle;
  const typeColor = typeConfig[commitment.type]?.color || "text-gray-500";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!responseMove || !content) return;

    try {
      await createResponse.mutateAsync({
        phaseId: phaseId || "current",
        summary: content,
        moves: [
          {
            targetCommitmentId: commitment.id,
            moveType: responseMove,
            explanation: content,
            revisionDescription: actionTaken || undefined,
          },
        ],
      });

      // Reset and close
      setResponseMove("");
      setContent("");
      setActionTaken("");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create response:", error);
    }
  };

  const selectedMove = responseMoves.find((m) => m.value === responseMove);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <MessageSquare className="w-4 h-4 mr-1" />
          Respond
          {existingResponses && existingResponses.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {existingResponses.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Author Response</DialogTitle>
            <DialogDescription>
              Respond to the reviewer&apos;s {commitment.type.toLowerCase().replace("_", " ")}
            </DialogDescription>
          </DialogHeader>

          {/* Commitment being responded to */}
          <div className="my-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TypeIcon className={`w-4 h-4 ${typeColor}`} />
              <span className="text-sm font-medium">
                {commitment.type.replace("_", " ")}
              </span>
              {commitment.reviewer && (
                <span className="text-xs text-muted-foreground">
                  from {commitment.reviewer.name || commitment.reviewer.email}
                </span>
              )}
            </div>
            <p className="text-sm">{commitment.content}</p>
          </div>

          <div className="space-y-4">
            {/* Response Move Selection */}
            <div className="space-y-2">
              <Label>Response Type</Label>
              <Select value={responseMove} onValueChange={setResponseMove}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your response type..." />
                </SelectTrigger>
                <SelectContent>
                  {responseMoves.map((move) => (
                    <SelectItem key={move.value} value={move.value}>
                      <div className="flex flex-col">
                        <span>{move.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMove && (
                <p className="text-xs text-muted-foreground">
                  {selectedMove.description}
                </p>
              )}
            </div>

            {/* Response Content */}
            <div className="space-y-2">
              <Label htmlFor="response-content">Your Response</Label>
              <Textarea
                id="response-content"
                placeholder="Explain your response to the reviewer..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                required
              />
            </div>

            {/* Action Taken (for CONCEDE/PARTIAL_CONCEDE) */}
            {(responseMove === "CONCEDE" ||
              responseMove === "PARTIAL_CONCEDE") && (
              <div className="space-y-2">
                <Label htmlFor="action-taken">Action Taken (Optional)</Label>
                <Textarea
                  id="action-taken"
                  placeholder="Describe the specific changes you've made..."
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Documenting actions helps track what was changed in response
                </p>
              </div>
            )}

            {/* Previous Responses */}
            {existingResponses && existingResponses.length > 0 && (
              <div className="space-y-2">
                <Label>Previous Responses</Label>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {existingResponses.map((response: {
                    id: string;
                    responseMove: string;
                    content: string;
                    createdAt: string;
                  }) => (
                    <div
                      key={response.id}
                      className="p-2 bg-muted/50 rounded text-sm"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {response.responseMove}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(response.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="line-clamp-2">{response.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!responseMove || !content || createResponse.isPending}
            >
              {createResponse.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit Response
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
