import { Meta } from "./types";

async function request(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.status === 429 && i < retries - 1) {
      const wait = Number(res.headers.get("retry-after")) || 0.5;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`mb ${res.status}`);
    return res.json();
  }
  throw new Error("mb failed after retries");
}

export async function fetchFromMusicBrainz(id: string): Promise<Meta | null> {
  const data = await request(
    `https://musicbrainz.org/ws/2/recording/${id}?inc=artists+releases+tags&fmt=json`,
  );
  if (!data) return null;
  const release = data.releases && data.releases[0];
  const date = release?.date || "";
  return {
    genres: (data.tags || []).map((t: any) => t.name),
    year: date ? Number(date.slice(0, 4)) : NaN,
    synopsis: "",
  };
}
