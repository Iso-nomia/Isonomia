import { Meta } from "./types";

async function request(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status === 429 && i < retries - 1) {
      const wait = Number(res.headers.get("retry-after")) || 0.5;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`ol ${res.status}`);
    return res.json();
  }
  throw new Error("ol failed after retries");
}

export async function fetchFromOpenLibrary(id: string): Promise<Meta | null> {
  const data = await request(`https://openlibrary.org/works/${id}.json`);
  if (!data) return null;
  const desc = typeof data.description === "string"
    ? data.description
    : data.description?.value || "";
  return {
    genres: data.subjects || [],
    year: data.first_publish_date
      ? Number(String(data.first_publish_date).slice(0, 4))
      : NaN,
    synopsis: desc,
  };
}
