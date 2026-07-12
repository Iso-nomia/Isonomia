// lib/uploadItemImage.ts
import { supabase } from "./supabase-browser";

export async function uploadItemImage(stallId: string, file: File): Promise<string> {
  const ext = file.type.split('/')[1] ?? 'jpg';
  const filename = `${stallId}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase
    .storage
    .from('stall-images')
    .upload(filename, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase
    .storage
    .from('stall-images')
    .getPublicUrl(filename);

  if (!data?.publicUrl) throw new Error('Could not obtain public URL');
  return data.publicUrl;
}
