// favorites_builder.ts
/* eslint‑disable @typescript-eslint/no‑unsafe‑argument */
import type { PrismaClient } from '@prisma/client';
import { performance } from 'node:perf_hooks';

export interface RunOptions {
  /** Restrict to a single user (UUID or bigint-as-string) */
  userId?: string;
  /** ISO‑8601 timestamp; process items added strictly after this time */
  since?: string;
  /** Disable network calls when running in CI */
  dryRun?: boolean;
}



export interface RunResult {
  favoritesProcessed: number;
  embeddingsRequested: number;
  tokensUsed: number;
  usersUpdated: number;
  latencyMs: number;
}

if (!process.env.EMBEDDING_URL) {
  throw new Error('[favorites_builder] EMBEDDING_URL env var is required');
}
const EMBEDDING_ENDPOINT: string = process.env.EMBEDDING_URL;
const PCA_DIM_IN = 768;
const PCA_DIM_OUT = 256;
const BATCH_SIZE = 200; // for embedding calls
const MAX_FAVS_PER_USER = 1_000;

type Matrix = number[][] & { 0: { length: typeof PCA_DIM_IN } };

let pcaCache: Matrix | null = null;
async function loadPcaMatrix(): Promise<Matrix> {
  if (pcaCache) return pcaCache;
  const url = process.env.PCA_MATRIX_URL;
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch PCA matrix ${res.status}`);
    pcaCache = (await res.json()) as Matrix;
  } else {
    // 256×768 identity‑slice fallback
    pcaCache = Array.from({ length: PCA_DIM_OUT }, (_, i) =>
      Array.from({ length: PCA_DIM_IN }, (_x, j) => (i === j ? 1 : 0)),
    ) as Matrix;
  }
  return pcaCache;
}

/** Fast dot‑product projection */
function project(vec: ArrayLike<number>, pca: Matrix): Float32Array {
  const out = new Float32Array(pca.length);
  for (let i = 0; i < pca.length; i++) {
    let sum = 0;
    const row = pca[i];
    for (let j = 0; j < PCA_DIM_IN; j++) sum += row[j] * vec[j];
    out[i] = sum;
  }
  return out;
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Converts a JS array → safe Postgres vector literal */
function vecToPg(arr: Float32Array): string {
  return `'[${Array.from(arr).join(',')}]'`;
}

// /api/_cron/favorites_builder.ts
export default async function handler(
  req: { method?: string },
  res: {
    status: (code: number) => {
      send: (body: string) => unknown;
      json: (body: unknown) => unknown;
    };
  },
) {
  if (process.env.ENABLE_FAV_BUILDER !== 'true') {
    return res.status(200).send('favorites builder disabled');
  }

  try {
    const result = await run();
    console.table(result);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).send('builder error');
  }
}

export async function run(opts: RunOptions = {}): Promise<RunResult> {
  const start = performance.now();
  const prisma: PrismaClient = (await import('@/lib/prismaclient')).prisma;

  const since = opts.since ? new Date(opts.since) : new Date(0);
  const favs = await prisma.favoriteItem.findMany({
    where: {
      addedAt: { gt: since },
      ...(opts.userId ? { userId: BigInt(opts.userId) } : {}),
    },
    include: { media: true },
    orderBy: { addedAt: 'desc' },
  });
  if (favs.length === 0) {
    return {
      favoritesProcessed: 0,
      embeddingsRequested: 0,
      tokensUsed: 0,
      usersUpdated: 0,
      latencyMs: Math.round(performance.now() - start),
    };
  }

  // ------------------------------------------------------------------ #
  // 1. Ensure embeddings (batch POST)                                  #
  // ------------------------------------------------------------------ #
  const missingIds = favs
    .filter(f => !f.media.embedding || f.media.embedding.length === 0)
    .map(f => f.mediaId);

  let embeddingsRequested = 0;
  let tokensUsed = 0;

  if (!opts.dryRun && missingIds.length) {
    for (const batch of chunk(missingIds, BATCH_SIZE)) {
      try {
        const res = await fetch(EMBEDDING_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: batch }), // ⬅ adjust `/api/embed` to accept `{ids:[]}`
        });
        if (!res.ok) {
          console.error('Embedding batch failed', res.status, await res.text());
          continue;
        }
        const body = (await res.json()) as {
          tokens: number;
          processed: string[];
        };
        embeddingsRequested += body.processed.length;
        tokensUsed += body.tokens ?? 0;
      } catch (err) {
        console.error('Embedding fetch error', err);
      }
    }
  }

  // Refresh favourites list with now‑cached embeddings if we requested any
  if (embeddingsRequested)
    await prisma.$disconnect().then(() => prisma.$connect());

  // ------------------------------------------------------------------ #
  // 2. Group embeddings per user                                       #
  // ------------------------------------------------------------------ #
  const byUser: Record<string, Float32Array[]> = {};
  for (const fav of favs) {
    const emb = fav.media.embedding as number[] | null;
    if (!emb || emb.length !== PCA_DIM_IN) continue;
    const uid = String(fav.userId);
    (byUser[uid] ||= []).push(Float32Array.from(emb));
  }

  const pca = await loadPcaMatrix();

  // ------------------------------------------------------------------ #
  // 3. Build 256‑D taste vector per user                               #
  // ------------------------------------------------------------------ #
  type UpsertRow = { user_id: string; vec: string };
  const rows: UpsertRow[] = [];

  for (const [uid, list] of Object.entries(byUser)) {
    const embs = list.slice(0, MAX_FAVS_PER_USER);
    if (embs.length === 0) continue; // avoid ÷0
    const accum = new Float32Array(PCA_DIM_OUT);
    for (const e of embs) {
      const proj = project(e, pca);
      for (let i = 0; i < PCA_DIM_OUT; i++) accum[i] += proj[i];
    }
    for (let i = 0; i < PCA_DIM_OUT; i++) accum[i] /= embs.length;
    rows.push({ user_id: uid, vec: vecToPg(accum) });
  }

  // ------------------------------------------------------------------ #
  // 4. Bulk upsert                                                     #
  // ------------------------------------------------------------------ #
  if (rows.length && !opts.dryRun) {
    /* example SQL:
       INSERT INTO user_taste_vectors (user_id, taste, updated_at)
       SELECT * FROM UNNEST(ARRAY[uid1,uid2]::uuid[], ARRAY[taste1,taste2]::vector[])
       ON CONFLICT (user_id) DO UPDATE SET taste = EXCLUDED.taste, updated_at = NOW();
    */
    const userIds = rows.map(r => r.user_id);
    const vectors = rows.map(r => r.vec);
    await prisma.$executeRawUnsafe(`
      WITH data AS (
        SELECT UNNEST($1::uuid[])  AS uid,
               UNNEST($2::vector[]) AS taste
      )
      INSERT INTO user_taste_vectors (user_id, taste, updated_at)
      SELECT uid, taste, NOW() FROM data
      ON CONFLICT (user_id)
      DO UPDATE SET taste = EXCLUDED.taste, updated_at = NOW();
    `, userIds, vectors);
  }

  // ------------------------------------------------------------------ #
  // 5. Done                                                            #
  // ------------------------------------------------------------------ #
  const result: RunResult = {
    favoritesProcessed: favs.length,
    embeddingsRequested,
    tokensUsed,
    usersUpdated: rows.length,
    latencyMs: Math.round(performance.now() - start),
  };
  console.table(result);
  return result;
}
