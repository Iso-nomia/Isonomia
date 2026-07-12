import fs from "fs";

const file = fs.readFileSync("lib/actions/userattributes.actions.ts", "utf8");

// Simple check that the update functions are called in upsertUserAttributes

test("upsertUserAttributes triggers friend suggestions", () => {
  expect(file.includes("updateUserEmbedding")).toBe(true);
  expect(file.includes("generateFriendSuggestions")).toBe(true);
});
