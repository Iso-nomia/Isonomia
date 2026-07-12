import { v4 as uuid } from "uuid";
import { supabase } from "../supabaseclient";
 import { supabaseAdmin } from "@/lib/supabaseAdmin";
 import { ATTACHMENTS_BUCKET } from "./constants";
// export async function uploadAttachment(file: File) {
//   const ext = file.name.split(".").pop();
//   const path = `${uuid()}.${ext}`;
//   const { error } = await supabase.storage
//     .from("message-attachments")
//     .upload(path, file, { contentType: file.type });
//   if (error) throw error;
//   const { data } = await supabase.storage
//     .from("message-attachments")
//     .createSignedUrl(path, 60 * 60 * 24 * 7);
//   return { url: data.signedUrl, size: file.size, type: file.type };
// }
// uploadAttachment.ts
export async function uploadAttachment(file: Blob & { name?: string; type: string; size: number }) {
  const ext = file.name?.split(".").pop() || "bin";
  const path = `attachments/${new Date().toISOString().slice(0,10)}/${uuid()}.${ext}`;

  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  
  return { path, size: file.size, type: file.type };
}

// optional helper for when you need a URL
export async function signAttachment(path: string, expiresIn = 60 * 10) {
  const { data, error } = await supabaseAdmin.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
