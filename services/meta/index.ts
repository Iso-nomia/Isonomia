import { fetchFromTMDb } from "./tmdb";
import { fetchFromMusicBrainz } from "./musicbrainz";
import { fetchFromOpenLibrary } from "./openlibrary";
import { Meta, ProviderType } from "./types";
import { getCached, setCached } from "./cache";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchMetaAndUpsert(
  db: SupabaseClient,
  id: string,
  type: ProviderType,
  externalId: string,
): Promise<Meta | null> {
  const cacheKey = `meta:${type}:${externalId}`;
  const cached = await getCached(cacheKey);
  if (cached) return JSON.parse(cached) as Meta;

  let meta: Meta | null = null;
  const start = Date.now();
  if (type === "movie" || type === "tv") meta = await fetchFromTMDb(externalId);
  else if (type === "music") meta = await fetchFromMusicBrainz(externalId);
  else meta = await fetchFromOpenLibrary(externalId);
  const ms = Date.now() - start;
  if (!meta) return null;

  await setCached(cacheKey, JSON.stringify(meta));
  await db.from("canonical_media").update({
    metadata: meta,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  await db.from("edge_logs.external_meta").insert({
    provider: type,
    ms,
  });

  return meta;
}
