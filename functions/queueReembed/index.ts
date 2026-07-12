// functions/queueReembed/index.ts
import { serve }  from "https://deno.land/std@0.192.0/http/server.ts";
import { Queue }  from "https://esm.sh/bullmq@5";   // same major as workers
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
//  Supabase service‑role client (edge: Deno.env)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,          //   **NOT** NEXT_PUBLIC_…
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// ---------------------------------------------------------------------------
//  BullMQ queue that the Node worker is listening to
const queue = new Queue("reembed", {
  connection: {
    host: Deno.env.get("REDIS_HOST") ?? "127.0.0.1",
    port: Number(Deno.env.get("REDIS_PORT") ?? 6379),
    username: Deno.env.get("REDIS_USER") || undefined,
    password: Deno.env.get("REDIS_PASS") || undefined,
    tls      : Deno.env.get("REDIS_TLS")  ? {} : undefined,
  },
});

// ---------------------------------------------------------------------------
//  HTTP handler – called by the **Supabase DB Webhook** on
//  INSERT/UPDATE into favorites-raw or linked_accounts.
serve(async (req) => {
  const { record } = await req.json();              // row payload
  const userId = record.user_id ?? record.id;       // adjust to trigger source

  // enqueue (“fire‑and‑forget”)
  await queue.add("reembed-now", { userId });

  return new Response("ok", { status: 200 });
});
