// Stub data file for demo
import type { Message, ForumComment, Participant } from "./types";

interface Discussion {
  id: string;
  title: string;
  description: string | null;
  createdById: string;
  conversationId: string | null;
  deliberations: unknown[];
}

interface SeedData {
  discussion: Discussion;
  messages: Message[];
  forumComments: unknown[];
  participants: Participant[];
  conversationId: string;
  currentUserId: string;
}

export async function getSeededDiscussion(): Promise<SeedData | null> {
  return null;
}
