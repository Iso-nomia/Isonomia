import { z } from "zod";

export const userSettingsSchema = z.object({
  account: z
    .object({
      displayName: z.string().min(2).max(40).optional(),
      handle: z.string().regex(/^@[a-z0-9_]{3,}$/i).optional(),
      bio: z.string().max(200).optional(),
      photoUrl: z.string().url().optional(),
    })
    .optional(),

  privacy: z
    .object({
      profileVisibility: z.enum(["PUBLIC", "FOLLOWERS", "PRIVATE"]).optional(),
      blockedIds: z.array(z.bigint()).optional(),
    })
    .optional(),

  notifications: z
    .object({
      push: z.boolean().optional(),
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      digestFrequency: z.enum(["NONE", "DAILY", "WEEKLY"]).optional(),
    })
    .optional(),
}).strict();
