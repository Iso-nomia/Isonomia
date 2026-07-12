import axios from "axios";
import { createGunzip } from "zlib";
import readline from "readline";
import { prisma } from "../lib/prismaclient";

export interface MovieDumpEntry {
  id: string;
  title: string;
}

export async function fetchMovieDump(limit = 50000): Promise<MovieDumpEntry[]> {
  const url = "https://files.tmdb.org/p/exports/movie_ids_07_01_2025.json.gz";
  const response = await axios.get(url, { responseType: "stream" });
  const gunzip = createGunzip();
  const rl = readline.createInterface({ input: response.data.pipe(gunzip) });
  const results: MovieDumpEntry[] = [];
  for await (const line of rl) {
    if (!line) continue;
    const obj = JSON.parse(line.toString());
    results.push({ id: `tmdb_${obj.id}`, title: obj.title });
    if (results.length >= limit) break;
  }
  return results;
}

export async function seedCMD() {
  const movies = await fetchMovieDump();
  await prisma.canonicalMedia.createMany({
    data: movies.map((m) => ({
      id: m.id,
      title: m.title,
      mediaType: "MOVIE",
      metadata: {},
      embedding: [],
    })),
    skipDuplicates: true,
  });
}

if (require.main === module) {
  seedCMD().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
