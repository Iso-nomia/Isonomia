"use server";

import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/server/getUser";

export async function createPoll(input: {
  conversationId: bigint;
  messageId: bigint;
  kind: "OPTIONS" | "TEMP";
  options?: string[];
}) {
  const user = await getUserFromCookies();
  if (!user?.userId) throw new Error("unauthorized");

  if (input.kind === "OPTIONS") {
    const opts = input.options ?? [];
    if (opts.length < 2 || opts.length > 10) throw new Error("bad options");
  }

  const poll = await prisma.poll.create({
    data: {
      conversation_id: input.conversationId,
      message_id: input.messageId,
      created_by_id: BigInt(user.userId),
      kind: input.kind,
      options: input.kind === "OPTIONS" ? input.options! : undefined,
      max_options: 1,
    },
  });

  return poll;
}

export async function upsertVote(input: {
  pollId: bigint;
  kind: "OPTIONS" | "TEMP";
  optionIdx?: number;
  value?: number;
}) {
  const user = await getUserFromCookies();
  if (!user?.userId) throw new Error("unauthorized");

  const poll = await prisma.poll.findUnique({ where: { id: input.pollId } });
  if (!poll) throw new Error("not found");
  if (poll.kind !== input.kind) throw new Error("bad kind");

  if (poll.kind === "OPTIONS") {
    if (typeof input.optionIdx !== "number") throw new Error("missing optionIdx");
    if (!poll.options || input.optionIdx < 0 || input.optionIdx >= poll.options.length) {
      throw new Error("bad optionIdx");
    }
  } else {
    if (typeof input.value !== "number" || input.value < 0 || input.value > 100) {
      throw new Error("bad value");
    }
  }

  await prisma.pollVote.upsert({
    where: { poll_id_user_id: { poll_id: poll.id, user_id: BigInt(user.userId) } },
    update: { option_idx: input.optionIdx ?? null, value: input.value ?? null },
    create: {
      poll_id: poll.id,
      user_id: BigInt(user.userId),
      option_idx: input.optionIdx ?? null,
      value: input.value ?? null,
    },
  });

  if (poll.kind === "OPTIONS") {
    const rows = await prisma.pollVote.groupBy({
      by: ["option_idx"],
      where: { poll_id: poll.id },
      _count: { _all: true },
    });
    const totals = new Array(poll.options?.length ?? 0).fill(0);
    for (const r of rows) {
      const idx = r.option_idx ?? -1;
      if (idx >= 0 && idx < totals.length) totals[idx] = r._count._all;
    }
    const count = rows.reduce((a, r) => a + r._count._all, 0);
    return {
      poll,
      state: {
        kind: "OPTIONS" as const,
        pollId: String(poll.id),
        totals,
        count,
      },
    };
  } else {
    const agg = await prisma.pollVote.aggregate({
      where: { poll_id: poll.id, value: { not: null } },
      _avg: { value: true },
      _count: { _all: true },
    });
    return {
      poll,
      state: {
        kind: "TEMP" as const,
        pollId: String(poll.id),
        avg: Math.round(agg._avg.value ?? 0),
        count: agg._count._all ?? 0,
      },
    };
  }
}
