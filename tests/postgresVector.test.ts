import { knn } from "@/util/postgresVector";
import { mockClient } from "../jest/__mocks__/pg";

jest.mock("pg");

describe("knn", () => {
  it("returns self similarity rank 1", async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ taste: "[1,0]" }] })
      .mockResolvedValueOnce({
        rows: [
          { user_id: 1, score: 1 },
          { user_id: 2, score: 0.8 },
        ],
      });
    const res = await knn("1", 2);
    expect(res[0].userId).toBe(1);
    expect(res[1].userId).toBe(2);
  });
});
