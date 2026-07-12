"use client";

import { supabase } from "@/lib/supabaseclient";

export async function upsertSectionPing(x: number, y: number) {
  try {
    await supabase.from("section_ping").upsert({
      x,
      y,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("ping failed", err);
  }
}
