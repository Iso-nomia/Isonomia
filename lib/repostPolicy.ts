export const REPOSTABLE_TYPES = ["TEXT"] as const;

export type RepostableType = (typeof REPOSTABLE_TYPES)[number];

export function canRepost(type?: string | null): type is RepostableType {
  return !!type && REPOSTABLE_TYPES.includes(type as RepostableType);
}
