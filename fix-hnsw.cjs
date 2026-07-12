const { Client } = require("pg");
(async () => {
  const c = new Client({
    connectionString: "postgresql://postgres:Craba2r2!1017@db.odqbxixizrecsuiqmecq.supabase.co:5432/postgres",
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query("SET statement_timeout = 0");
  await c.query("SET lock_timeout = 0");
  console.log("timeouts cleared; current:", (await c.query("SHOW statement_timeout")).rows[0]);
  console.log("DROP INDEX CONCURRENTLY argument_embedding_hnsw…");
  const t0 = Date.now();
  await c.query('DROP INDEX CONCURRENTLY IF EXISTS "argument_embedding_hnsw"');
  console.log("dropped in", Date.now() - t0, "ms");
  await c.end();
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
