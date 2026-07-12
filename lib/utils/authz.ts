// utils/authz.ts
export const isAuthor = (viewerId?: string | number | bigint | null, authorId?: string | number | bigint | null) =>
  viewerId != null && authorId != null && String(viewerId) === String(authorId);
