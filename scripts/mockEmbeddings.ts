// scripts/mockEmbeddings.ts
import 'dotenv/config';
import { prisma } from '@/lib/prismaclient';
import { randomUUID } from 'node:crypto';

const DIM = 1536;
function randVec() {
  // unit‑length gaussian vector to keep magnitudes reasonable
  const v = Array.from({ length: DIM }, () => Math.random() - 0.5);
  const norm = Math.hypot(...v);
  return v.map(x => x / norm);
}

async function main(count = 3000) {
  const rows = Array.from({ length: count }, () => ({
    track_id: randomUUID().replace(/-/g,'').slice(0,22),
    vector:   randVec(),
  }));

  // chunk insert (≤500 rows) just like the real script
  for (let i = 0; i < rows.length; i += 500) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO track_embedding (track_id, vector)
      SELECT * FROM jsonb_to_recordset($1::jsonb)
             AS x(track_id text, vector float8[])
    `, JSON.stringify(rows.slice(i, i + 500)));
    process.stdout.write(`\rinserted ${Math.min(i+500,rows.length)} / ${rows.length}`);
  }
  console.log('\n✅  done');
}

main(Number(process.argv[2] ?? '3000')).catch(console.error);
