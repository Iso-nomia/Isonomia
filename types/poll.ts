export type PollKind = "OPTIONS" | "TEMP";

export type PollDTO = {
  id: string;
  conversationId: string;
  messageId: string;
  createdById: string;
  kind: PollKind;
  options?: string[];
  maxOptions: number;
  closesAt?: string | null;
  anonymous: boolean;
  createdAt: string;
};

export type PollStateDTO =
  | { kind: "OPTIONS"; pollId: string; totals: number[]; count: number }
  | { kind: "TEMP"; pollId: string; avg: number; count: number };

export type MyVoteDTO =
  | { kind: "OPTIONS"; pollId: string; optionIdx: number | null }
  | { kind: "TEMP"; pollId: string; value: number | null };
