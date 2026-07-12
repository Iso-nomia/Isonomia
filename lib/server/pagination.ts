import { z } from 'zod';

export const PaginationQuery = z.object({
  cursor: z.string().optional(),                    // opaque id
  limit: z.coerce.number().int().positive().max(100).default(50), // hard cap 100
  sort: z.enum(['createdAt:desc','createdAt:asc']).default('createdAt:desc'),
});

export type Page<T> = { items: T[]; nextCursor: string|null };

export function makePage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? rows[limit - 1].id : null;
  return { items, nextCursor };
}
