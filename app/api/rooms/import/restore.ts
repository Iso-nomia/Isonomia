// server/import/restore.ts
import fs from "node:fs";
import { spawn } from "node:child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import path from "node:path";

export async function unpackTarZstToTmp(buf: ArrayBuffer) {
  const p = "/tmp/room-" + Date.now();
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(p + ".zst", Buffer.from(buf));
  await new Promise((resolve, reject) => {
    const t = spawn("tar", ["--zstd", "-xf", p + ".zst", "-C", p]);
    t.on("exit", (c) => (c === 0 ? resolve(0) : reject(new Error("tar failed"))));
  });
  return p;
}

export async function restoreDbFromFile(dsn: string, file: string) {
  await new Promise((resolve, reject) => {
    const p = spawn("psql", [dsn, "-v", "ON_ERROR_STOP=1", "-f", file], { stdio: "inherit" });
    p.on("exit", (c) => (c === 0 ? resolve(0) : reject(new Error("psql failed"))));
  });
}

export async function uploadMediaFolder(s3: S3Client, bucket: string, folder: string) {
  const walk = (dir: string, out: string[] = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out); else out.push(p);
    }
    return out;
  };
  const files = walk(folder);
  for (const f of files) {
    const key = path.relative(folder, f).replace(/\\/g, "/");
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(f),
    }));
  }
}
