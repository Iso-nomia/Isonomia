import { describe, it, expect, vi } from "vitest";

describe("embed api", () => {
  it("handles response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ embedding: [0.1], cached: true }),
    }));

    const resp = await fetchMock("/api/embed", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith("/api/embed", expect.anything());
    const data = await resp.json();
    expect(data).toMatchObject({ embedding: expect.any(Array), cached: true });
  });
});
