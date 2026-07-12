// scripts/generateEmbeddings.ts
//
// npx tsx -r dotenv/config scripts/generateEmbeddings.ts <uid>
import 'dotenv/config';
import axios                         from 'axios';
import { prisma }                    from '@/lib/prismaclient';
import { createClient }              from '@supabase/supabase-js';
import { Readable }                  from 'node:stream';
import { parser }                    from 'stream-json';
import { streamArray }               from 'stream-json/streamers/StreamArray';

/* ─── Supabase (service‑role) ─────────────────────────────────────── */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

/* ─── Helper: read newest raw json → [{id,text}] ───────────────────── */
async function loadTrackRows(uid: number): Promise<{ id: string; text: string }[]> {
  const prefix = `spotify/${uid}/`;
  const { data: list } = await supabase
    .storage.from('favorites-raw')
    .list(prefix, { limit: 1, sortBy: { column: 'name', order: 'desc' } });

  if (!list?.[0]) return [];
  const key = prefix + list[0].name;

  const { data: blob } = await supabase.storage.from('favorites-raw').download(key);
  if (!blob) return [];

  const rows: { id: string; text: string }[] = [];
  await new Promise<void>((res, rej) =>
    Readable.fromWeb(blob.stream())
      .pipe(parser()).pipe(streamArray())
      .on('data', ({ value }) => {
        const id     = value.track?.id;
        const title  = value.track?.name   ?? '';
        const artist = value.track?.artists?.[0]?.name ?? '';
        const year   = value.track?.album?.release_date?.slice(0, 4) ?? '';
        if (id) rows.push({ id, text: `song: ${title} · artist: ${artist} · year: ${year}` });
      })
      .on('end', res).on('error', rej),
  );
  return rows;
}

/* ─── Embedding with OpenAI + back‑off ─────────────────────────────── */
async function embedBatchOpenAI(texts: string[]): Promise<number[][]> {
  const { data } = await axios.post(
    'https://api.openai.com/v1/embeddings',
    { model: 'text-embedding-3-small', input: texts, encoding_format: 'float' },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } },
  );
  return data.data.map((d: any) => d.embedding);
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function embedWithBackoff(texts: string[]): Promise<number[][]> {
  for (let retry = 0; retry < 5; retry++) {
    try {
      return await embedBatchOpenAI(texts);
    } catch (e: any) {
      if (e.response?.status === 429) {
        const delay = (2 ** retry) * 1_000;
        console.warn(`↻ OpenAI 429 – sleeping ${delay} ms`);
        await sleep(delay);
        continue;
      }
      throw e;
    }
  }
  throw new Error('Embedding rate‑limited too many times');
}

/* ─── MAIN ─────────────────────────────────────────────────────────── */
async function main() {
  const uid = Number(process.argv[2] ?? '1');

  /* 1 — rows = {id,text}[] */
  const rows = await loadTrackRows(uid);
  if (!rows.length) {
    console.log('❌  no favourites for user', uid);
    return;
  }

  /* 2 — drop ids already embedded */
  const existing = await prisma.track_embedding.findMany({
    where: { track_id: { in: rows.map(r => r.id) } },
    select: { track_id: true },
  });
  const done = new Set(existing.map(r => r.track_id));
  const todo = rows.filter(r => !done.has(r.id));
  if (!todo.length) {
    console.log('✓ nothing new to embed');
    return;
  }
  console.log(`→ need embeddings for ${todo.length} tracks (provider: OpenAI)`);

  /* 3 — embed ≤96 texts per call */
  const inserted: { track_id: string; vector: number[] }[] = [];
  for (let i = 0; i < todo.length; i += 96) {
    const batch = todo.slice(i, i + 96);
    const vecs  = await embedWithBackoff(batch.map(b => b.text));
    vecs.forEach((v, idx) =>
      inserted.push({ track_id: batch[idx].id, vector: v }),
    );
    process.stdout.write(`\r   progress: ${inserted.length}/${todo.length}`);
  }
  console.log('');

/* 4 — chunked insert to avoid >50 MB payloads */
for (let i = 0; i < inserted.length; i += 500) {
    const slice = inserted.slice(i, i + 500);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO track_embedding (track_id, vector)
      SELECT track_id,
             vector::vector                  
      FROM jsonb_to_recordset($1::jsonb)
           AS x(track_id text, vector float8[])
      ON CONFLICT (track_id) DO NOTHING;
    `,
      JSON.stringify(slice),
    );
    process.stdout.write(`\r   db insert: ${Math.min(i + 500, inserted.length)}/${inserted.length}`);
  }
  console.log('\n✓ all inserts done');
//   } else {
//     console.log('⚠️  zero embeddings inserted – something went wrong');
//   }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
