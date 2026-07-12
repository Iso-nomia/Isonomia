"use server";

import { supabase } from "@/lib/supabaseclient";
import { getUserFromCookies } from "@/lib/serverutils";

export interface Integration {
  id: string;
  service: string;
  credential: string;
}

export async function fetchIntegrations() {
  const user = await getUserFromCookies();
  if (!user) throw new Error("User not authenticated");
  const { data, error } = await supabase
    .from("integrations")
    .select("id, service, credential")
    .eq("user_id", user.userId?.toString());
  if (error) throw new Error(error.message);
  return data as Integration[];
}

export async function saveIntegration({
  service,
  credential,
}: {
  service: string;
  credential: string;
}) {
  const user = await getUserFromCookies();
  if (!user) throw new Error("User not authenticated");
  try {
    const { error } = await supabase.from("integrations").upsert({
      user_id: user.userId?.toString(),
      service,
      credential,
    });
    if (error) {
      const msg = error.message || error.details || "Failed to save integration";
      console.error("Error saving integration", { message: msg, error });
      throw new Error(msg);
    }
  } catch (err: any) {
    console.error("Error saving integration", err);
    throw new Error(err.message || "Failed to save integration");
  }
}

export async function deleteIntegration(id: string) {
  const user = await getUserFromCookies();
  if (!user) throw new Error("User not authenticated");
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.userId?.toString());
  if (error) throw new Error(error.message);
}
