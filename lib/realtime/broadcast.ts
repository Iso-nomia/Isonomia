// // lib/realtime/broadcast.ts
// export async function broadcast(topic: string, event: string, payload: any) {
//     const url =
//       (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, "") +
//       "/realtime/v1/api/broadcast";
//     const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
//     if (!url || !key) throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  
//     const body = {
//       messages: [
//         {
//           topic,         // e.g. "conversation-8"
//           event,         // e.g. "new_message"
//           type: "broadcast",
//           payload,       // your DTO
//           private: false
//         }
//       ]
//     };
  
//     const res = await fetch(url, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         apikey: key,
//         Authorization: `Bearer ${key}`,
//       },
//       body: JSON.stringify(body),
//     });
  
//     if (!res.ok) {
//       const txt = await res.text().catch(() => "");
//       throw new Error(`Broadcast ${event} failed: ${res.status} ${txt}`);
//     }
//     return true;
//   }
  
// lib/realtime/broadcast.ts
export async function broadcast(topic: string, event: string, payload: any) {
    const base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
    const key  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!base || !key) throw new Error("Missing SUPABASE_URL or service role key");
    const res = await fetch(`${base}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        messages: [{ topic, event, type: "broadcast", payload, private: false }],
      }),
    });
    if (!res.ok) throw new Error(`Broadcast ${event} failed: ${res.status} ${await res.text().catch(() => "")}`);
    return true;
  }
  