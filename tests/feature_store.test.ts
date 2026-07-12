import { Client } from "pg";

let client: Client;

beforeAll(async () => {
  client = new Client({ user: "root", host: "/var/run/postgresql", database: "postgres" });
  await client.connect();
  await client.query("CREATE TABLE IF NOT EXISTS scroll_events(user_id BIGINT, dwell_ms INT)");
  await client.query("DROP MATERIALIZED VIEW IF EXISTS user_dwell_avg");
  await client.query("DROP TABLE IF EXISTS user_taste_vectors CASCADE");
  await client.query(`CREATE TABLE user_taste_vectors (
    user_id BIGINT PRIMARY KEY,
    taste vector(256) NOT NULL,
    traits JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await client.query(`CREATE INDEX user_taste_vectors_ann ON user_taste_vectors USING ivfflat (taste vector_cosine_ops) WITH (lists = 100)`);
  await client.query(`CREATE MATERIALIZED VIEW user_dwell_avg AS SELECT user_id, AVG(dwell_ms) AS avg_dwell_ms FROM scroll_events GROUP BY user_id`);
});

afterAll(async () => {
  await client.end();
});

describe("feature store", () => {
  test("knn query ranks self first", async () => {
    const vec = Array(256).fill(0);
    vec[0] = 1;
    const vectorStr = `[${vec.join(",")}]`;
    await client.query("INSERT INTO user_taste_vectors(user_id, taste) VALUES ($1, $2::vector)", [1, vectorStr]);
    const { rows } = await client.query("SELECT user_id FROM user_taste_vectors ORDER BY taste <-> $1::vector LIMIT 1", [vectorStr]);
    expect(Number(rows[0].user_id)).toBe(1);
  });

  test("materialized view refresh completes quickly", async () => {
    await client.query("TRUNCATE scroll_events");
    const values = [] as { user_id: number; dwell_ms: number }[];
    for (let i = 0; i < 1000; i++) values.push({ user_id: i % 10, dwell_ms: 100 });
    for (const v of values) {
      await client.query("INSERT INTO scroll_events(user_id, dwell_ms) VALUES ($1,$2)", [v.user_id, v.dwell_ms]);
    }
    const start = Date.now();
    await client.query("REFRESH MATERIALIZED VIEW user_dwell_avg");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
});
