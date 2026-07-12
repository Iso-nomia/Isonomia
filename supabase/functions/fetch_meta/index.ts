// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { object, string, parse } from "https://esm.sh/valibot@0.15.0";
import { fetchFromTMDb } from "../../../services/meta/tmdb.ts";
import { fetchFromMusicBrainz } from "../../../services/meta/musicbrainz.ts";
import { fetchFromOpenLibrary } from "../../../services/meta/openlibrary.ts";
import { createClient as createRedis } from "https://deno.land/x/redis@v0.29.4/mod.ts";
import { getRedis } from "@/lib/redis.js";
const schema = object({
  id: string(),
  type: string(),
  external_id: string(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const redis = await createRedis({
  hostname: Deno.env.get("REDIS_HOST") || "127.0.0.1",
  port: Number(Deno.env.get("REDIS_PORT") || 6379),
  password: Deno.env.get("REDIS_PASSWORD") || undefined,
});

async function getCached(key: string) {
  const redis = getRedis();
  if (redis) {
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
  }
}

async function setCached(key: string, value: unknown) {
  const redis = getRedis();
if (redis) {
  
  await redis.setex(key, 86400, JSON.stringify(value));
}
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const params = parse(schema, {
    id: url.searchParams.get("id"),
    type: url.searchParams.get("type"),
    external_id: url.searchParams.get("external_id"),
  });

  const cacheKey = `meta:${params.type}:${params.external_id}`;
  const cached = await getCached(cacheKey);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let meta = null;
  const start = Date.now();
  if (params.type === "movie" || params.type === "tv") {
    meta = await fetchFromTMDb(params.external_id);
  } else if (params.type === "music") {
    meta = await fetchFromMusicBrainz(params.external_id);
  } else {
    meta = await fetchFromOpenLibrary(params.external_id);
  }
  const ms = Date.now() - start;

  if (!meta) return new Response("not found", { status: 404 });

  await setCached(cacheKey, meta);

  await supabase.from("canonical_media").update({
    metadata: meta,
    updated_at: new Date().toISOString(),
  }).eq("id", params.id);

  await supabase.from("edge_logs.external_meta").insert({
    provider: params.type,
    ms,
  });

  return new Response(JSON.stringify(meta), {
    headers: { "Content-Type": "application/json" },
  });
});
