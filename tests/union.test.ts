import { unionWithoutDuplicates } from "@/lib/union";

describe("unionWithoutDuplicates", () => {
  it("preserves order and removes dups", () => {
    const res = unionWithoutDuplicates(["a", "b"], ["b", "c"]);
    expect(res).toEqual(["a", "b", "c"]);
  });
});
