export const dynamic = "force-dynamic";

// app/api/debug/db/route.ts
//
// ⚠️  DEV-ONLY — blocked in production. Returns 404 unless NODE_ENV=development.
//
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { jsonSafe } from "@/lib/bigintjson";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [row] = await prisma.$queryRawUnsafe<any[]>(`
    select
      current_database()                as db,
      current_user                      as db_user,
      inet_server_addr()::text          as host,
      inet_server_port()                as port,
      current_setting('search_path')    as search_path,
      now()                             as now,
      (select count(*) from messages)   as messages_count,
      (select max(created_at) from messages) as last_message_at
  `);
  return NextResponse.json(jsonSafe(row));
}
