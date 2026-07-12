// lib/actions/sites.actions.ts
"use server";

import { prisma } from "@/lib/prismaclient";

export type UpsertSiteArgs = {
  slug: string;
  ownerId: bigint | number | string;  // 👈 allow string
  pageUrl: string;
  snapshot?: string | null;
  title?: string | null;
  caption?: string | null;
  isPublic?: boolean;
};

function toBigIntId(v: bigint | number | string): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string" && /^\d+$/.test(v)) return BigInt(v);
  throw new Error("ownerId must be bigint/number/decimal string");
}
export async function upsertProfileSite({
  slug,
  ownerId,
  pageUrl,
  snapshot = null,
  title = null,
  caption = null,
  isPublic = true,
}: UpsertSiteArgs) {
  const owner = toBigIntId(ownerId);   // 👈 normalize here
  return prisma.profileSite.upsert({
    where: { slug },
    update: { pageUrl, snapshot, title, caption, isPublic },
    create: { slug, ownerId: owner, pageUrl, snapshot, title, caption, isPublic },
    select: { id: true, slug: true },
  });
}

export async function listMySites(ownerId: bigint | number | string) {
  const owner = toBigIntId(ownerId);
  return prisma.profileSite.findMany({
    where: { ownerId: owner },
    orderBy: { createdAt: "desc" },
    select: { slug: true, title: true, caption: true, pageUrl: true, snapshot: true, createdAt: true },
  });
}