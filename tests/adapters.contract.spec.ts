import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { setupServer } from "msw/node";
import { rest } from "msw";
import { fetchMetaAndUpsert } from "../services/meta";

const server = setupServer();

beforeAll(() => server.listen());
afterAll(() => server.close());

const update = vi.fn();
const insert = vi.fn();
const mockDb = { from: vi.fn(() => ({ update, insert })) } as any;

it("tmdb adapter maps fields", async () => {
  server.use(
    rest.get("https://api.themoviedb.org/3/movie/603", (_req, res, ctx) =>
      res(
        ctx.json({
          genres: [{ name: "Action" }],
          release_date: "1999-03-31",
          overview: "desc",
          poster_path: "/p.jpg",
        }),
      ),
    ),
  );
  const data = await fetchMetaAndUpsert(mockDb, "id", "movie", "603");
  expect(data).toEqual({
    genres: ["Action"],
    year: 1999,
    synopsis: "desc",
    poster_url: "https://image.tmdb.org/t/p/w500/p.jpg",
  });
  expect(update).toHaveBeenCalledTimes(1);
});

it("musicbrainz adapter maps fields", async () => {
  server.use(
    rest.get(
      "https://musicbrainz.org/ws/2/recording/mbid",
      (_req, res, ctx) =>
        res(
          ctx.json({
            tags: [{ name: "rock" }],
            releases: [{ date: "2001-01-01" }],
          }),
        ),
    ),
  );
  const data = await fetchMetaAndUpsert(mockDb, "id", "music", "mbid");
  expect(data).toEqual({ genres: ["rock"], year: 2001, synopsis: "" });
  expect(update).toHaveBeenCalledTimes(2);
});

it("openlibrary adapter maps fields", async () => {
  server.use(
    rest.get("https://openlibrary.org/works/olid.json", (_req, res, ctx) =>
      res(
        ctx.json({
          subjects: ["s1"],
          first_publish_date: "1984",
          description: { value: "d" },
        }),
      ),
    ),
  );
  const data = await fetchMetaAndUpsert(mockDb, "id", "book", "olid");
  expect(data).toEqual({ genres: ["s1"], year: 1984, synopsis: "d" });
  expect(update).toHaveBeenCalledTimes(3);
});
