// prisma.config.ts
import path from "node:path";
import { defineConfig } from "prisma/config";
import "dotenv/config";

/**
 * Minimal config that mirrors what you had in package.json:
 * {
 *   "prisma": { "schema": "lib/models/schema.prisma" }
 * }
 */
export default defineConfig({
  schema: path.join(process.cwd(), "lib", "models", "schema.prisma"),


  // Where generated migrations live (defaults to prisma/migrations)
//   migrations: {
//     path: path.join(process.cwd(), "prisma", "migrations"),
//   },

  // Example: run your existing seed command via Prisma
  // NOTE: until the top-level `seed` key is fixed, nest it here
//   seed: "tsx --env-file=.env scripts/seed.ts",

  // Example: force specific binary targets
  // binaryTargets: ["native", "debian-openssl-3.1.x"],
//   dotenv: true,

});
