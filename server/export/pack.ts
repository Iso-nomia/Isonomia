// server/export/pack.ts
import tar from "tar-stream";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";
import { RoomManifest } from "./manifest";
import { signDetached } from "@/server/trust/sign";

export function packAsTarZst(entries: {
  dbSql: Readable;
  media: Array<{ path: string; stream: Readable }>;
  manifest: RoomManifest;
}) {
  const pack = tar.pack();

  (async () => {
    // 1) db.sql
    await new Promise<void>((resolve, reject) => {
      const e = pack.entry({ name: "db.sql" }, (err?: Error | null) => (err ? reject(err) : resolve()));
      entries.dbSql.on("error", reject).pipe(e).on("error", reject);
    });

    // 2) media/*
    for (const m of entries.media) {
      await new Promise<void>((resolve, reject) => {
        const e = pack.entry({ name: `media/${m.path}` }, (err) => err ? reject(err) : resolve());
        m.stream.on("error", reject).pipe(e).on("error", reject);
      });
    }
    // 3) manifest.json
    const manifestJson = Buffer.from(JSON.stringify(entries.manifest, null, 2));
    pack.entry({ name: "manifest.json" }, manifestJson);

    // 4) export.signature
    const sig = signDetached(manifestJson);
    pack.entry({ name: "export.signature" }, sig);

    pack.finalize();
  })().catch((e) => pack.destroy(e));

  // zstd (requires `zstd` in PATH). Fallback: return plain tar if missing.
  try {
    const zstd = spawn("zstd", ["-q", "-T0", "-19"], { stdio: ["pipe", "pipe", "inherit"] });
    pack.pipe(zstd.stdin!);
    return zstd.stdout!;
  } catch {
    return pack; // plain .tar (you can serve .tar if zstd missing)
  }
}
