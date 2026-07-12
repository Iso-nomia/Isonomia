/* ────────────────────────────────────────────────────────────── */
/* friend‑suggestions.actions.ts                                 */
/* ────────────────────────────────────────────────────────────── */
"use server";

import { prisma } from "../prismaclient";
import { deepseekEmbedding } from "../deepseekclient";
import { getPineconeIndex } from "@/lib/pineconeClient";
import type { UserAttributes } from "@prisma/client";

type Big = bigint;

/* ---------- utilities --------------------------------------- */
const cosineSimilarity = (a: number[], b: number[]) => {
  const dot   = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (normA * normB);
};

const safeJoin = (arr?: string[] | null) => (arr ?? []).join(" ");
/** Returns a string[] even when the raw value is string | bigint | Date | undefined. */
const toStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];


/* ---------- embedding upsert -------------------------------- */
export async function updateUserEmbedding(userId: Big) {
  const attrs = await prisma.userAttributes.findUnique({
    where: { user_id: userId },
  });
  if (!attrs) return;

  const desc = [
    safeJoin(attrs.interests),
    safeJoin(attrs.hobbies),
    safeJoin(attrs.artists),
    safeJoin(attrs.albums),
    safeJoin(attrs.movies),
    safeJoin(attrs.books),
    safeJoin(attrs.communities),
  ].join("\n");

  const embedding = await deepseekEmbedding(desc);

  await prisma.userEmbedding.upsert({
    where: { user_id: userId },
    update: { embedding },
    create: { user_id: userId, embedding },
  });

  try {
    const index = await getPineconeIndex();
    if (index) {
      await index.upsert([{ id: userId.toString(), values: embedding }]);
    }
  } catch (err) {
    console.warn("Pinecone upsert failed", err);
  }
}

/* ---------- main generator ---------------------------------- */
export async function generateFriendSuggestions(userId: Big) {
  const base = await prisma.userEmbedding.findUnique({
    where: { user_id: userId },
  });
  if (!base) return [];

  /* -- nearest neighbours (Pinecone) ------------------------- */
  const index = await getPineconeIndex();
  if (!index) return [];

  const neighbours = await index.query({
    topK: 300,
    vector: base.embedding,
    includeValues: false,
  });

  const otherIds = neighbours.matches.map((m) => BigInt(m.id));
  if (otherIds.length === 0) return [];

  /* -- bulk fetch everything we need -------------------------- */
  const [
    baseLikes,
    baseRooms,
    otherLikes,
    otherRooms,
    otherEmbeddings,
    otherAttrs,
  ] = await Promise.all([
    prisma.like.findMany({ where: { user_id: userId }, select: { feed_post_id: true } }),
    prisma.userRealtimeRoom.findMany({
      where: { user_id: userId },
      select: { realtime_room_id: true },
    }),
    prisma.like.findMany({
      where: { user_id: { in: otherIds } },
      select: { user_id: true, feed_post_id: true },
    }),
    prisma.userRealtimeRoom.findMany({
      where: { user_id: { in: otherIds } },
      select: { user_id: true, realtime_room_id: true },
    }),
    prisma.userEmbedding.findMany({
      where: { user_id: { in: otherIds } },
    }),
    prisma.userAttributes.findMany({ where: { user_id: { in: otherIds } } }),
  ]);

  /* -- constant‑time lookup maps ----------------------------- */
  const baseLikeSet = new Set(baseLikes.map((l) => l.feed_post_id.toString()));
  const baseRoomSet = new Set(baseRooms.map((r) => r.realtime_room_id));

  const likesMap = new Map<Big, Set<string>>();
  for (const { user_id, feed_post_id } of otherLikes) {
    const set = likesMap.get(user_id as Big) ?? new Set<string>();
    set.add(feed_post_id.toString());
    likesMap.set(user_id as Big, set);
  }

  const roomsMap = new Map<Big, Set<string>>();
  for (const { user_id, realtime_room_id } of otherRooms) {
    const set = roomsMap.get(user_id as Big) ?? new Set<string>();
    set.add(realtime_room_id);
    roomsMap.set(user_id as Big, set);
  }

  const embMap  = new Map(otherEmbeddings.map((e) => [e.user_id as Big, e]));
  const attrMap = new Map<Big, UserAttributes>(
    otherAttrs.map((ua) => [ua.user_id as Big, ua]),
  );

  /* -- score -------------------------------------------------- */
  const scored = otherIds.map((oid: Big) => {
    const otherEmb = embMap.get(oid)!;

    const likeSet = likesMap.get(oid) ?? new Set();
    const roomSet = roomsMap.get(oid) ?? new Set();

    let overlapLikes = 0;
    // for (const p of likeSet) if (baseLikeSet.has(p)) overlapLikes++;

    let overlapRooms = 0;
    // for (const r of roomSet) if (baseRoomSet.has(r)) overlapRooms++;

    for (const p of likeSet) if (baseLikeSet.has(p)) overlapLikes++;
for (const r of roomSet) if (baseRoomSet.has(r)) overlapRooms++;


    const sim   = cosineSimilarity(base.embedding, otherEmb.embedding);
    const score = 0.6 * sim + 0.2 * overlapLikes + 0.2 * overlapRooms;

    return { id: oid, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const winners = scored.slice(0, 5);

  /* -- persist ------------------------------------------------ */
  await prisma.$transaction([
    prisma.friendSuggestion.deleteMany({ where: { user_id: userId } }),
    prisma.friendSuggestion.createMany({
      data: winners.map((w) => ({
        user_id: userId,
        suggested_user_id: w.id,
        score: w.score,
      })),
    }),
  ]);

  return winners; // [{ id, score }]
}

/* ---------- fetch + enrich for UI --------------------------- */
export async function fetchFriendSuggestions(userId: Big) {
  const suggestions = await prisma.friendSuggestion.findMany({
    where: { user_id: userId },
    orderBy: { score: "desc" },
    take: 5,
  });
  if (!suggestions.length) return [];

  const attrIds = suggestions.map((s) => s.suggested_user_id);
  const [baseAttrs, extraAttrs] = await Promise.all([
    prisma.userAttributes.findUnique({ where: { user_id: userId } }),
    prisma.userAttributes.findMany({ where: { user_id: { in: attrIds } } }),
  ]);

  const attrMap = new Map(extraAttrs.map((ua) => [ua.user_id as Big, ua]));

  const arrayFields: (keyof UserAttributes)[] = [
    "artists",
    "albums",
    "songs",
    "interests",
    "movies",
    "books",
    "hobbies",
    "communities",
  ];

  const calcOverlap = (otherId: Big) => {
    if (!baseAttrs) return {};
    const other = attrMap.get(otherId);
    if (!other) return {};

    const overlap: Record<string, string[]> = {};
    for (const field of arrayFields) {
      const arrBase = toStringArray((baseAttrs as any)[field]);
      const arrOther = toStringArray((other as any)[field]);
      const inter = arrBase.filter((v) => arrOther.includes(v));
      if (inter.length) overlap[field] = inter;
    }
    if (baseAttrs.location && baseAttrs.location === other.location) {
      overlap.location = [baseAttrs.location];
    }
    return overlap;
  };

  /* fetch basic user fields in one go */
  const basicUsers = await prisma.user.findMany({
    where: { id: { in: attrIds.map(Number) } },
    select: { id: true, name: true, username: true, image: true },
  });
  const basicMap = new Map(basicUsers.map((u) => [BigInt(u.id), u]));

  return suggestions.map((s) => {
    const u = basicMap.get(s.suggested_user_id as Big)!;
    return {
      id: u.id,
      name: u.name,
      username: u.username,
      image: u.image,
      score: s.score,
      overlap: calcOverlap(s.suggested_user_id),
    };
  });
}

/* ---------- TSConfig note ---------------------------------- */
/**
 * Iterating Sets/Maps requires "downlevelIteration": true if your tsconfig
 * target < ES2015.  Most Next.js apps already target ES2020, but if
 * you see TS2802 errors, add this to tsconfig.json:
 *
 *   {
 *     "compilerOptions": {
 *       "target": "es2020",
 *       "lib": ["dom", "es2020"],
 *       "downlevelIteration": true
 *     }
 *   }
 */
