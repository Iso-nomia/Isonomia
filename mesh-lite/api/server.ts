// mesh-lite/api/server.ts
import http from "node:http";
import { URL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// ───────────────────────────────────────────────────────────────────
// Env / config
// ───────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 8787);
const DB_URL = process.env.DATABASE_URL!;
if (!DB_URL) throw new Error("DATABASE_URL is required");

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "http://localhost:9000";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "room-media";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || "mesh";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || "meshmesh";

// S3 client pointed at MinIO
const s3 = new S3Client({
  endpoint: MINIO_ENDPOINT,
  forcePathStyle: true,
  region: "us-east-1",
  credentials: { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY },
});

// Root prisma (no schema override) for introspection
const rootPrisma = new PrismaClient();

// Very small per-schema Prisma cache
const prismaCache = new Map<string, PrismaClient>();
function prismaForSchema(schema: string): PrismaClient {
  const key = schema;
  const existing = prismaCache.get(key);
  if (existing) return existing;
  const client = new PrismaClient({ datasources: { db: { url: `${DB_URL}?schema=${encodeURIComponent(schema)}` } } });
  prismaCache.set(key, client);
  return client;
}

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────
function sendJSON(res: http.ServerResponse, code: number, data: any) {
  res.writeHead(code, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(data));
}

function sendText(res: http.ServerResponse, code: number, text: string, headers: Record<string, string> = {}) {
  res.writeHead(code, { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*", ...headers });
  res.end(text);
}

async function streamS3(res: http.ServerResponse, key: string) {
  const out = await s3.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
  const body = out.Body as any as NodeJS.ReadableStream;
  const ctype = (out.ContentType as string) || "application/octet-stream";
  res.writeHead(200, { "content-type": ctype, "cache-control": "no-store", "access-control-allow-origin": "*" });
  body.on("error", (e) => {
    try { res.destroy(e); } catch {}
  });
  body.pipe(res);
}

// List room_* schemas from pg_namespace
async function listRoomSchemas(): Promise<string[]> {
  const rows = await rootPrisma.$queryRawUnsafe<{ nspname: string }[]>(
    `SELECT nspname FROM pg_namespace WHERE nspname LIKE 'room\\_%' ESCAPE '\\' ORDER BY nspname`
  );
  return rows.map((r) => r.nspname);
}

async function roomCounts(schema: string): Promise<Record<string, number>> {
  const prisma = prismaForSchema(schema);
  const q = (sql: string) => prisma.$queryRawUnsafe<{ cnt: number }[]>(sql).then((r) => r[0]?.cnt ?? 0);

  // Only count tables that likely exist; ignore errors (0 if table missing)
  const tryCount = async (table: string) => {
    try {
      return await q(`SELECT COUNT(*)::int AS cnt FROM "${schema}"."${table}"`);
    } catch {
      return 0;
    }
  };

  const messages = await tryCount("messages");
  const realtime_posts = await tryCount("realtime_posts");
  const sheaf_facets = await tryCount("sheaf_facets");

  return { messages, realtime_posts, sheaf_facets };
}

// ───────────────────────────────────────────────────────────────────
// HTTP server
// ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    // CORS / preflight
    if (req.method === "OPTIONS") {
      res.writeHead(200, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      return res.end();
    }

    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Health
    if (req.method === "GET" && pathname === "/health") {
      return sendJSON(res, 200, { ok: true, service: "mesh-lite", minio: MINIO_ENDPOINT });
    }

    // GET /rooms — list available room_* schemas
    if (req.method === "GET" && pathname === "/rooms") {
      const rooms = await listRoomSchemas();
      return sendJSON(res, 200, { ok: true, rooms });
    }

    // GET /rooms/:id/counts — quick counts for a room_<id> schema
    // Accept either exact schema name or bare id (we’ll prefix with room_)
    if (req.method === "GET" && /^\/rooms\/[^/]+\/counts$/.test(pathname)) {
      const id = pathname.split("/")[2]; // after /rooms/
      const schema = id.startsWith("room_") ? id : `room_${id}`;
      const rooms = await listRoomSchemas();
      if (!rooms.includes(schema)) return sendJSON(res, 404, { ok: false, error: "room schema not found", schema });
      const counts = await roomCounts(schema);
      return sendJSON(res, 200, { ok: true, schema, counts });
    }

    // GET /media/* — stream from MinIO bucket (defaults to MINIO_BUCKET)
    if (req.method === "GET" && pathname.startsWith("/media/")) {
      const key = decodeURIComponent(pathname.replace(/^\/media\//, ""));
      if (!key) return sendJSON(res, 400, { ok: false, error: "missing key" });
      return streamS3(res, key);
    }

    // GET /receipt — fetch the Sovereignty Receipt from MinIO
    if (req.method === "GET" && pathname === "/receipt") {
      return streamS3(res, "__sovereignty/receipt.json");
    }

    // GET / — friendly landing
    if (req.method === "GET" && pathname === "/") {
      return sendJSON(res, 200, {
        ok: true,
        service: "mesh-lite",
        endpoints: ["/health", "/rooms", "/rooms/:id/counts", "/media/<key>", "/receipt"],
      });
    }

    return sendText(res, 404, "Not Found");
  } catch (err: any) {
    console.error(err);
    return sendJSON(res, 500, { ok: false, error: err?.message || "internal error" });
  }
});

server.listen(PORT, () => {
  console.log(`mesh-lite api on :${PORT}`);
  console.log(`MinIO: ${MINIO_ENDPOINT} bucket=${MINIO_BUCKET}`);
});
