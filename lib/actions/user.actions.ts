"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "../prismaclient";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { getUserFromCookies } from "../serverutils";
import { User } from "@prisma/client";
const userCacheById = new Map<bigint, User| null>();
const userCacheByAuthId = new Map<string, User | null>();

export async function clearUserCache() {
  userCacheById.clear();
  userCacheByAuthId.clear();
}

export interface UpdateUserParams {
  userAuthId: string;
  username: string;
  name: string;
  bio: string;
  image: string;
  path: string;
}

export interface FetchUsersParams {
  userId: bigint;
  searchString?: string;
  pageNumber?: number;
  pageSize?: number;
  sortBy?: Prisma.SortOrder;
}

export async function updateUser({
  userAuthId,
  username,
  name,
  bio,
  image,
  path,
}: UpdateUserParams) {
  try {
    const result = await prisma.user.upsert({
      where: {
        auth_id: userAuthId,
      },
      update: {
        username: username.toLowerCase(),
        name: name,
        bio: bio,
        image: image,
        onboarded: true,
      },
      create: {
        auth_id: userAuthId,
        username: username.toLowerCase(),
        name: name,
        bio: bio,
        image: image,
        onboarded: true,
      },
    });
    if (path === "/profile/edit") {
      revalidatePath(path);
    }
    return result;
  } catch (error: any) {
    throw new Error(`Failed to create/update user: ${error.message}`);
  }
}

export async function updateUserBio({ bio, path }: { bio: string; path: string }) {
  const user = await getUserFromCookies();
  if (!user) {
    throw new Error("User not authenticated");
  }
  try {
    await prisma.user.update({
      where: {
        id: user.userId!,
      },
      data: { bio },
    });
    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to update bio: ${error.message}`);
  }
}

export async function fetchUserByAuthId(userAuthId: string) {
  if (userCacheByAuthId.has(userAuthId)) {
    return userCacheByAuthId.get(userAuthId) ?? null;
  }
  try {

    await prisma.$connect();
    const user = await prisma.user.findUnique({
      where: {
        auth_id: userAuthId,
      },
    });
    userCacheByAuthId.set(userAuthId, user ?? null);
    if (user) {
      userCacheById.set(user.id, user);
    }
    return user;
  } catch (error: any) {
    throw new Error(`Failed to get user: ${error.message}`);
  }
}

export async function fetchUser(userId: bigint) {
  if (userCacheById.has(userId)) {
    return userCacheById.get(userId) ?? null;
  }
  try {

    await prisma.$connect();
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    userCacheById.set(userId, user ?? null);
    if (user) {
      userCacheByAuthId.set(user.auth_id, user);
    }
    return user;
  } catch (error: any) {
    throw new Error(`Failed to get user: ${error.message}`);
  }
}

export async function fetchUserByUsername(username: string) {
  try {
    return await prisma.user.findFirst({
      where: { username: username.toLowerCase() },
    });
  } catch (error: any) {
    throw new Error(`Failed to get user: ${error.message}`);
  }
}

export async function fetchUserThreads(userId: bigint) {
  try {
    const posts = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        feedPosts: {
          where: {
            OR: [
              { expiration_date: null },
              { expiration_date: { gt: new Date() } },
            ],
          },
          include: {
            author: true,
            children: {
              include: {
                author: {
                  select: {
                    name: true,
                    image: true,
                    id: true,
                  },
                },
                _count: { select: { children: true } },
              },
            },
            _count: { select: { children: true } },
          },
          orderBy: {
            created_at: Prisma.SortOrder.desc,
          },
        },
      },
    });
    if (!posts) return null;
    const mapped = {
      ...posts,
      posts: posts.feedPosts.map((p) => ({
        ...p,
        commentCount: p._count.children,
        children: p.children.map((c) => ({
          ...c,
          commentCount: c._count.children,
        })),
      })),
    };
    return mapped;
  } catch (error: any) {
    throw new Error(`Failed to fetch user threads: ${error.message}`);
  }
}

export async function fetchUsers({
  userId,
  searchString = "",
  pageNumber = 1,
  pageSize = 20,
  sortBy = Prisma.SortOrder.desc,
}: FetchUsersParams) {
  try {
    const skipAmount = (pageNumber - 1) * pageSize;
    const query: Prisma.UserWhereInput[] = [
      {
        NOT: {
          id: userId,
        },
      },
    ];
    if (searchString.trim() !== "") {
      const orQuery: Prisma.UserWhereInput = {
        OR: [
          {
            username: {
              contains: searchString,
            },
          },
          {
            name: {
              contains: searchString,
            },
          },
        ],
      };
      query.push(orQuery);
    }
    const users = await prisma.user.findMany({
      where: {
        AND: query,
      },
      skip: skipAmount,
      take: pageSize,
      orderBy: {
        created_at: sortBy,
      },
    });
    const totalUsersCount = await prisma.user.count({
      where: {
        AND: query,
      },
    });
    const isNext = totalUsersCount > skipAmount + users.length;
    return { users, isNext };
  } catch (error: any) {
    throw new Error(`Failed to fetch users ${error.message}`);
  }
}

export async function getActivity(userId: bigint) {
  try {
    const userThreads = await prisma.feedPost.findMany({
      where: {
        author_id: userId,
      },
      include: {
        children: {
          select: {
            id: true,
          },
        },
      },
    });

    const childThreadIds = userThreads.flatMap((userThread) =>
      userThread.children.map((child) => child.id)
    );
    const replies = await prisma.feedPost.findMany({
      where: {
        AND: [
          {
            id: {
              in: childThreadIds,
            },
            author_id: {
              not: userId,
            },
          },
        ],
      },
      include: {
        author: {
          select: {
            name: true,
            image: true,
            id: true,
          },
        },
      },
    });
    return replies;
  } catch (error: any) {
    throw new Error(`Failed to fetch activity ${error.message}`);
  }
}

export async function fetchRandomUsers(count = 3) {
  try {
    const total = await prisma.user.count({
      where: { onboarded: true },
    });
    const take = Math.min(count, total);
    if (take === 0) return [];
    const skip = Math.max(0, Math.floor(Math.random() * Math.max(total - take + 1, 1)));
    const users = await prisma.user.findMany({
      where: { onboarded: true },
      skip,
      take,
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
      },
    });
    return users.map((u) => ({
      ...u,
      id: Number(u.id),
    }));
  } catch (error: any) {
    throw new Error(`Failed to fetch random users: ${error.message}`);
  }
}

export interface CreateDefaultUserParams {
  authId: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

export async function createDefaultUser({
  authId,
  email,
  name,
  image,
}: CreateDefaultUserParams) {
  try {
    const usernameBase = email ? email.split("@")[0] : `user-${nanoid(6)}`;
    const user = await prisma.user.create({
      data: {
        auth_id: authId,
        username: usernameBase.toLowerCase(),
        name: name ?? "New User",
        bio: "",
        image: image ?? null,
        onboarded: true,
      },
    });
    return user;
  } catch (error: any) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.user.findUnique({
        where: { auth_id: authId },
      });
      if (existing) {
        return existing;
      }
    }
    throw new Error(`Failed to create user: ${error.message}`);
  }
}
