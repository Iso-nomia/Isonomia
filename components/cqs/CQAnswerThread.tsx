"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CQAnswerThreadProps {
  netId: string;
  questionId: string;
  targetSchemeId?: string;
}

interface Answer {
  id: string;
  answerText: string;
  createdAt: string;
  helpful: number;
  notHelpful: number;
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

export function CQAnswerThread({
  netId,
  questionId,
  targetSchemeId,
}: CQAnswerThreadProps) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnswers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netId, questionId]);

  const loadAnswers = async () => {
    try {
      const url = `/api/nets/${netId}/cqs/answer?questionId=${questionId}${
        targetSchemeId ? `&targetSchemeId=${targetSchemeId}` : ""
      }`;
      const response = await fetch(url);
      const data = await response.json();
      setAnswers(data.answers || []);
    } catch (error) {
      console.error("Failed to load answers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (answerId: string, voteType: "helpful" | "notHelpful") => {
    try {
      // TODO: Implement vote API
      console.log(`Vote ${voteType} for answer ${answerId}`);
    } catch (error) {
      console.error("Failed to vote:", error);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading answers...</div>;
  }

  if (answers.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No answers yet. Be the first to answer!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {answers.map((answer) => (
        <Card key={answer.id} className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={answer.user?.image || undefined} />
              <AvatarFallback>
                {answer.user?.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {answer.user?.name || "Anonymous"}
                </p>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(answer.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>

              <p className="text-sm text-gray-700">{answer.answerText}</p>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => handleVote(answer.id, "helpful")}
                >
                  <ThumbsUp className="w-3 h-3 mr-1" />
                  {answer.helpful}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => handleVote(answer.id, "notHelpful")}
                >
                  <ThumbsDown className="w-3 h-3 mr-1" />
                  {answer.notHelpful}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
