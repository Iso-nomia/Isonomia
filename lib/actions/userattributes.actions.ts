"use server";

import { Prisma, UserAttributes, visibility } from "@prisma/client";
import { prisma } from "../prismaclient";
import { revalidatePath } from "next/cache";
import { getUserFromCookies } from "@/lib/serverutils";
import {
  updateUserEmbedding,
  generateFriendSuggestions,
} from "./friend-suggestions.actions";

export interface UpsertUserAttributes {
  userAttributes: UserAttributes;
  path: string;
}

export async function upsertUserAttributes({
  userAttributes,
  path,
}: UpsertUserAttributes) {
  const user = await getUserFromCookies();
  if (!user) {
    throw new Error("User not authenticated");
  }
  try {

    const {
      
      artists = [],
      albums = [],
      songs = [],
      interests = [],
      movies = [],
      books = [],
      location = null,
      birthday = null,
      hobbies = [],
      communities = [],
      events_visibility = visibility.PUBLIC,
      tv_visibility = visibility.PUBLIC,
      podcasts_visibility = visibility.PUBLIC,
    } = userAttributes as Partial<UserAttributes>;

    const sanitize = (arr: string[]) => arr.filter(Boolean);

    await prisma.userAttributes.upsert({
      where: {
        user_id: user.userId!,
      },
      update: {
        artists: {
          set: sanitize(artists),
        },
        albums: {
          set: sanitize(albums),
        },
        songs: {
          set: sanitize(songs),
        },
        interests: {
          set: sanitize(interests),
        },
        movies: {
          set: sanitize(movies),
        },
        books: {
          set: sanitize(books),
        },
        location,
        birthday,
        hobbies: {
          set: sanitize(hobbies),
        },
        communities: {
          set: sanitize(communities),
        },
        events_visibility,
        tv_visibility,
        podcasts_visibility,
      },
      create: {
        user_id: user.userId!,
        artists: {
          set: sanitize(artists),
        },
        albums: {
          set: sanitize(albums),
        },
        songs: {
          set: sanitize(songs),
        },
        interests: {
          set: sanitize(interests),
        },
        movies: {
          set: sanitize(movies),
        },
        books: {
          set: sanitize(books),
        },
        location,
        birthday,
        hobbies: {
          set: sanitize(hobbies),
        },
        communities: {
          set: sanitize(communities),
        },
        events_visibility,
        tv_visibility,
        podcasts_visibility,
      },
    });
    await prisma.userAttributeEdit.create({
      data: { user_id: user.userId! },
    });
    await updateUserEmbedding(user.userId!);
    await generateFriendSuggestions(user.userId!);
    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to upsert user attributes: ${error.message}`);
  }
}

export async function fetchUserAttributes({
  userId,
}: {
  userId: bigint | null;
}) {
  if (!userId) return null;

  const userAttributes = await prisma.userAttributes.findUnique({
    where: {
      user_id: userId,
    },
  });

  return userAttributes;
}

export interface SearchUsersByAttributesParams {
  base: Partial<UserAttributes>;
  limit?: number;
}

export interface ScoredUser {
  id: bigint;
  name: string | null;
  username: string;
  image: string | null;
  score: number;
}

export async function searchUsersByAttributes({
  base,
  limit = 10,
}: SearchUsersByAttributesParams) {

  const others = await prisma.userAttributes.findMany({
    include: { user: true },
  });

  const intersection = (a: string[] | undefined | null, b: string[] | undefined | null) =>
    (a || []).filter((v) => (b || []).includes(v));

  const calcScore = (target: (typeof others)[number]) => {
    let score = 0;
    const fields: (keyof UserAttributes)[] = [
      "artists",
      "albums",
      "songs",
      "interests",
      "movies",
      "books",
      "hobbies",
      "communities",
    ];
    for (const field of fields) {
      const arrA = (base as any)[field] as string[] | undefined;
      const arrB = (target as any)[field] as string[] | undefined;
      score += intersection(arrA, arrB).length;
    }
    if (base.location && target.location && base.location === target.location) {
      score += 1;
    }
    return score;
  };

  const scored = others
    .map((o) => ({ user: o.user, score: calcScore(o) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const result: ScoredUser[] = scored.map((s) => ({
    id: s.user.id,
    name: s.user.name,
    username: s.user.username,
    image: s.user.image,
    score: s.score,
  }));

  return result;
}
