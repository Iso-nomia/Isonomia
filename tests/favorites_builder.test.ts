import { project } from "@/jobs/favorites_builder";

test("projection returns 256 dims", () => {
  const pca = Array.from({ length: 256 }, (_, i) => {
    const row = Array(768).fill(0);
    row[i] = 1;
    return row;
  });
  const emb = Array(768).fill(0);
  emb[0] = 1;
  const vec = project(emb, pca);
  expect(vec).toHaveLength(256);
  expect(vec[0]).toBe(1);
});

test("project identity fast", () => {
  const PCA = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ] as const;
  const v = [4, 5, 6];
  const t0 = performance.now();
  const out = project(v, PCA as any);
  expect(out).toEqual(Float32Array.from([4, 5, 6]));
  expect(performance.now() - t0).toBeLessThan(1);
});
