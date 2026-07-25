import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const originalsBucket = process.env.SUPABASE_VIDEO_ORIGINAIS_BUCKET ?? "video-originals";
export const editedBucket = process.env.SUPABASE_VIDEO_EDITADOS_BUCKET ?? "video-edited";

export async function downloadOriginal(storagePath: string, destination: string): Promise<void> {
  const { data, error } = await supabaseAdmin.storage.from(originalsBucket).download(storagePath);

  if (error) {
    throw new Error(`Failed to download ${storagePath}: ${error.message}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  await writeFile(destination, buffer);
}

export async function uploadEdited(
  localPath: string,
  storagePath: string,
  contentType = "video/mp4",
): Promise<string> {
  const buffer = await readFile(localPath);
  const { data, error } = await supabaseAdmin.storage
    .from(editedBucket)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload ${storagePath}: ${error.message}`);
  }

  return data.path;
}
