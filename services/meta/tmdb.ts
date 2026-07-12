import { Meta } from "./types";

const API_KEY = process.env.TMDB_API_KEY || "";

async function request(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status === 429 && i < retries - 1) {
      const wait = Number(res.headers.get("retry-after")) || 0.5;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`tmdb ${res.status}`);
    return res.json();
  }
  throw new Error("tmdb failed after retries");
}

export async function fetchFromTMDb(id: string): Promise<Meta | null> {
  const data = await request(
    `https://api.themoviedb.org/3/movie/${id}?language=en-US&api_key=${API_KEY}`,
  );
  if (!data) return null;
  return {
    genres: (data.genres || []).map((g: any) => g.name),
    year: data.release_date ? Number(data.release_date.slice(0, 4)) : NaN,
    synopsis: data.overview || "",
    poster_url: data.poster_path
      ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
      : undefined,
  };
}
