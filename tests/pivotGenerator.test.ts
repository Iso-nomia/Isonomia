import generatePuzzle from "@/app/(root)/(standard)/pivot/pivotGenerator";
import fs from "fs/promises";
import path from "path";

type Rings = [string[], string[], string[], string[]];

type OffsetTuple = [number, number, number, number];

async function loadDict() {
  const text = await fs.readFile(path.join(process.cwd(), "public/pivot/4letter.txt"), "utf8");
  return new Set(
    text
      .split(/\s+/)
      .map(w => w.trim().toUpperCase())
      .filter(w => /^[A-Z]{4}$/.test(w))
  );
}

beforeAll(() => {
  global.fetch = async (url: string) => {
    const file = await fs.readFile(path.join(process.cwd(), "public", url.replace(/^\//, "")), "utf8");
    return {
      text: async () => file,
    } as any;
  };
});

function rotate<T>(arr: readonly T[], k: number): T[] {
  const len = arr.length;
  const n = ((k % len) + len) % len;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

function computeSpokes(rings: Rings, offs: OffsetTuple) {
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

test("generator returns orientations that satisfy UI lock rule", async () => {
  const dict = await loadDict();
  const puzzle = await generatePuzzle();
  const spokes = computeSpokes(puzzle.rings as Rings, [0,0,0,0]);
  const solved = computeSpokes(puzzle.rings as Rings, puzzle.solutionOffsets as OffsetTuple);
  const areAllValid = solved.every(w => dict.has(w));
  expect(areAllValid).toBeTruthy();

  const hasInvalid = spokes.some(w => dict.has(w));
  expect(hasInvalid).toBeFalsy();
});

