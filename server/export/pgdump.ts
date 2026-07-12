// server/export/pgdump.ts
import { spawn } from "node:child_process";

export function streamPgDump(dsn: string, schema: string) {
  const args = [
    dsn,
    "--schema", schema,
    "--format=plain",
    "--no-owner",
    "--no-privileges",
  ];
  // mac/linux: pg_dump <dsn> --schema <schema> ...
  const p = spawn("pg_dump", args, { stdio: ["ignore", "pipe", "pipe"] });
  p.stderr.on("data", (d) => console.warn("[pg_dump]", d.toString()));
  return p.stdout; // Node Readable stream
}
