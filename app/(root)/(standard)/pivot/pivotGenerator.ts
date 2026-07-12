// lib/pivotGenerator.ts
import { loadWords4 } from "./words4";

const RING_LENGTHS = [9, 8, 7, 6] as const;
const PAR_MIN = 10;
const PAR_MAX = 25;

export type Rings = [string[], string[], string[], string[]];

export interface Puzzle {
  rings: Rings; // already rotated, ready for setState
  solutionOffsets: [number, number, number, number];
  words: string[];
  par: number;
  puzzleId: string;
}

async function generatePuzzle(): Promise<Puzzle> {
  const dictionary = new Set(await loadWords4());
  while (true) {
    const words = await pickWords(RING_LENGTHS[0], dictionary);
    const solved = splitIntoRings(words);
    const { rings, solutionOffsets } = scrambleRings(solved);

    const { unique, par } = bfsSolve(rings, dictionary);
    if (unique && par >= PAR_MIN && par <= PAR_MAX) {
      const puzzleId = Math.random().toString(36).slice(2, 10);
      return { rings, solutionOffsets, words, par, puzzleId };
    }
  }
}

/* ---------- helpers ---------- */

async function pickWords(n: number, dict: Set<string>): Promise<string[]> {

  // Draw without replacement until we have n distinct words
  // *Optionally*: reject sets where any ring would hold 2 identical letters,
  //               which prevents ambiguous alternative solutions.
  const selected = new Set<string>();
  const list = Array.from(dict);
  while (selected.size < n) {
    selected.add(list[Math.floor(Math.random() * list.length)]);
  }
  return Array.from(selected);
}

function splitIntoRings(words: string[]): Rings {
  const r1: string[] = [];
  const r2: string[] = [];
  const r3: string[] = [];
  const r4: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    r1.push(w[0]);
    if (i < RING_LENGTHS[1]) r2.push(w[1]);
    if (i < RING_LENGTHS[2]) r3.push(w[2]);
    if (i < RING_LENGTHS[3]) r4.push(w[3]);
  }
  return [r1, r2, r3, r4];
}
function scrambleRings([r1, r2, r3, r4]: Rings) {
  const rand = (len: number) => Math.floor(Math.random() * len);

  const offset1 = rand(RING_LENGTHS[0]);
  const offset2 = rand(RING_LENGTHS[1]);
  let offset3 = rand(RING_LENGTHS[2]);
  let offset4 = rand(RING_LENGTHS[3]);

  if (offset1 === 0 && offset2 === 0 && offset3 === 0 && offset4 === 0) {
    offset4 = (offset4 + 1) % RING_LENGTHS[3];
  }

  const rings: Rings = [
    rotate(r1, offset1),
    rotate(r2, offset2),
    rotate(r3, offset3),
    rotate(r4, offset4),
  ];

  const solutionOffsets: [number, number, number, number] = [offset1, offset2, offset3, offset4];
  return { rings, solutionOffsets };
}

function rotate<T>(arr: readonly T[], k: number): T[] {
  const len = arr.length;
  const n = ((k % len) + len) % len;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

function computeSpokes(rings: Rings, offs: number[]): string[] {
  const [r1, r2, r3, r4] = rings;
  const [o1, o2, o3, o4] = offs;
  const rot1 = rotate(r1, o1);
  const rot2 = rotate(r2, o2);
  const rot3 = rotate(r3, o3);
  const rot4 = rotate(r4, o4);
  return rot1.map((_, i) =>
    rot1[i] +
    rot2[i % rot2.length] +
    rot3[i % rot3.length] +
    rot4[i % rot4.length]
  );
}

function bfsSolve(rings: Rings, dict: Set<string>) {
  const lens = [rings[0].length, rings[1].length, rings[2].length, rings[3].length];
  const start = [0, 0, 0, 0];
  const key = (o: number[]) => o.join(",");
  const queue: Array<{o: number[]; d: number}> = [{ o: start, d: 0 }];
  const seen = new Set<string>([key(start)]);
  const solutions: Array<{o: number[]; d: number}> = [];

  while (queue.length) {
    const { o, d } = queue.shift()!;
    const words = computeSpokes(rings, o);
    if (words.every(w => dict.has(w))) {
      solutions.push({ o, d });
      continue;
    }
    for (let i = 0; i < 4; i++) {
      for (const dir of [-1, 1]) {
        const next = [...o];
        next[i] = (next[i] + dir + lens[i]) % lens[i];
        const k = key(next);
        if (!seen.has(k)) {
          seen.add(k);
          queue.push({ o: next, d: d + 1 });
        }
      }
    }
  }

  const unique = solutions.length === 1;
  const par = unique ? solutions[0].d : Infinity;
  return { unique, par };
}

export default generatePuzzle;
export { RING_LENGTHS };