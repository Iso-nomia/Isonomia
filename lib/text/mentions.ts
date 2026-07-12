
// lib/text/mentions.ts
export type MentionToken = { userId: string; start?: number; end?: number };

type Picked = { id: string; username: string };

export async function parseMentionsFromText(
  text: string,
  picked?: Picked[],
  lookupByUsernames?: (names: string[]) => Promise<Array<{ id: string; username: string }>>
): Promise<MentionToken[]> {
  const uniq = new Map<string, MentionToken>();

  // 1) Prefer composer-provided picks (exact IDs)
  for (const p of picked ?? []) {
    if (!uniq.has(p.id)) uniq.set(p.id, { userId: p.id });
  }

  // 2) Fallback: parse @username tokens
  const usernames = new Set<string>();
  const re = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{2,32})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const uname = m[2].toLowerCase();
    usernames.add(uname);
  }

  if (usernames.size && lookupByUsernames) {
    const found = await lookupByUsernames(Array.from(usernames));
    for (const f of found) {
      if (!uniq.has(f.id)) uniq.set(f.id, { userId: f.id });
    }
  }

  return Array.from(uniq.values()).slice(0, 32);
}

// If your Sheaf facet body is structured, normalize to text for scanning:
export function facetToPlainText(body: unknown): string {
  if (typeof body === "string") return body;
  try { return JSON.stringify(body); } catch { return ""; }
}