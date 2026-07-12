
import { z } from 'zod';


export type ArgSchemeWithCQs = {
  key: string;
  title: string;
  cq: ArgCQ[];
};


export const ArgCQSchema = z
  .object({
    // Some scheme `cq` JSON uses `key`, others use `cqKey` (e.g. seed.practical-
    // reasoning.ts writes `cqKey`). Accept either and normalize to `key` so the
    // CQ panel renders every scheme, not only the `key`-shaped minority.
    key: z.string().min(1).optional(),
    cqKey: z.string().min(1).optional(),
    text: z.string().min(1),
  })
  .refine((c) => !!(c.key ?? c.cqKey), {
    message: "cq requires `key` or `cqKey`",
  })
  .transform((c) => ({ key: (c.key ?? c.cqKey) as string, text: c.text }));

export const ArgCQArraySchema = z.array(ArgCQSchema);

// Handy TS type
export type ArgCQ = z.infer<typeof ArgCQSchema>;
