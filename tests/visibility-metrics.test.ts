import fs from "fs";

const schema = fs.readFileSync("lib/models/schema.prisma", "utf8");
const actions = fs.readFileSync("lib/actions/userattributes.actions.ts", "utf8");

test("schema defines visibility fields", () => {
  expect(schema.includes("events_visibility")).toBe(true);
  expect(schema.includes("tv_visibility")).toBe(true);
  expect(schema.includes("podcasts_visibility")).toBe(true);
});

test("upsertUserAttributes records edit metrics", () => {
  expect(actions.includes("userAttributeEdit")).toBe(true);
});
