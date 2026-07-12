import { Client } from "pg";

export interface Result {
  userId: number;
  score: number;
}

export async function knn(userId: string, k = 50): Promise<Result[]> {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();
  try {
    const vecRes = await client.query(
      "SELECT taste FROM user_taste_vectors WHERE user_id = $1",
      [userId],
    );
    if (vecRes.rows.length === 0) return [];
    const taste = vecRes.rows[0].taste;
    const { rows } = await client.query(
      `SELECT user_id, 1 - (taste <=> $1::vector) AS score
       FROM user_taste_vectors
       ORDER BY taste <-> $1::vector
       LIMIT $2`,
      [taste, k],
    );
    return rows.map((r) => ({ userId: Number(r.user_id), score: Number(r.score) }));
  } finally {
    await client.end();
  }
}
