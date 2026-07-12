import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prismaclient";
import { userSettingsSchema } from "./schema";

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function getUserSettings(userId: bigint) {
  const row = await prisma.userSettings.findUnique({ where: { user_id: userId } });
  return row?.prefs ?? {};
}

export async function updateUserSettings(userId: bigint, patch: unknown) {
  const data = userSettingsSchema.partial().parse(patch);
  const merged = { ...toObject(await getUserSettings(userId)), ...data };
  await prisma.userSettings.upsert({
    where: { user_id: userId },
    create: { user_id: userId, prefs: data as Prisma.InputJsonValue },
    update: { prefs: merged as Prisma.InputJsonValue },
  });
  return data;
}

export async function getWorkspaceSettings(workspaceId: bigint) {
  const row = await prisma.workspaceSettings.findUnique({ where: { workspace_id: workspaceId } });
  return row?.prefs ?? {};
}

export async function updateWorkspaceSettings(workspaceId: bigint, patch: unknown) {
  const data = userSettingsSchema.partial().parse(patch);
  const merged = { ...toObject(await getWorkspaceSettings(workspaceId)), ...data };
  await prisma.workspaceSettings.upsert({
    where: { workspace_id: workspaceId },
    create: { workspace_id: workspaceId, prefs: data as Prisma.InputJsonValue },
    update: { prefs: merged as Prisma.InputJsonValue },
  });
  return data;
}
