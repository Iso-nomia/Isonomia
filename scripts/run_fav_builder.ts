import { run } from "../jobs/favorites_builder";
import minimist from "minimist";

async function main() {
  const args = minimist(process.argv.slice(2));
  await run({ userId: args.user, since: args.since });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
